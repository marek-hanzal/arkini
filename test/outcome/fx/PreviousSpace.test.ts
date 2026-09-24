import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { startFx } from "~/game-start/fx/startFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import {
	itemOutcome,
	tableFn,
	spaceFn,
	configFn,
	spawnOwnerFx,
	settleFx,
} from "./OutcomeSettlement.test/fixture";

const previous = tableFn([
	spaceFn("previous"),
]);

describe("Previous Space", () => {
	it("starts without history and skips unavailable navigation while settling other outcomes", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* startFx();
				const before = yield* (yield* CommittedTransitionsFx).read;
				yield* settleFx(previous);
				const unchanged = yield* (yield* CommittedTransitionsFx).read;
				yield* settleFx(
					tableFn([
						spaceFn(4),
						spaceFn("previous"),
						{
							...itemOutcome,
							rules: [],
						},
					]),
				);
				return {
					before,
					unchanged,
					after: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: configFn(previous),
				}),
			),
		);
		expect(result.before.runtime.previousSpace).toBeUndefined();
		expect(result.unchanged).toBe(result.before);
		expect(result.after).toMatchObject({
			currentSpace: 4,
			previousSpace: 0,
		});
		expect(result.after.items.map(({ item }) => item.uid)).toEqual([
			"reward",
		]);
	});

	it("toggles A → B → A and keeps the return destination through save and a fresh loaded session", () => {
		const config = configFn(previous);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* settleFx(
					tableFn([
						spaceFn(7),
					]),
				);
				const b = yield* readRuntimeFx();
				yield* settleFx(previous);
				return {
					b,
					a: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.b).toMatchObject({
			currentSpace: 7,
			previousSpace: 0,
		});
		expect(result.a).toMatchObject({
			currentSpace: 0,
			previousSpace: 7,
		});
		const saved = StateSchema.parse(
			JSON.parse(
				JSON.stringify(
					fromRuntimeFn({
						runtime: result.a,
					}),
				),
			),
		);
		const loaded = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				yield* settleFx(previous);
				return {
					before,
					after: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
					state: saved,
				}),
			),
		);
		expect(loaded.before).toMatchObject({
			currentSpace: 0,
			previousSpace: 7,
		});
		expect(loaded.after).toMatchObject({
			currentSpace: 7,
			previousSpace: 0,
		});
	});

	it("uses committed history throughout mixed rolls and records only their final transition", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* settleFx(
					tableFn([
						spaceFn(7),
					]),
				);
				const mixed = tableFn([
					spaceFn(9),
					spaceFn("previous"),
				]);
				mixed.set[0]!.roll.push({
					type: "guaranteed",
					outcome: [
						spaceFn("previous"),
					],
				});
				yield* settleFx(mixed);
				const returned = yield* (yield* CommittedTransitionsFx).read;
				yield* settleFx(
					tableFn([
						spaceFn(0),
					]),
				);
				const same = yield* readRuntimeFx();
				yield* settleFx(
					tableFn([
						spaceFn("previous"),
						spaceFn(0),
					]),
				);
				return {
					returned,
					same,
					roundTrip: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: configFn(previous),
				}),
			),
		);
		expect(result.returned.runtime).toMatchObject({
			currentSpace: 0,
			previousSpace: 7,
		});
		expect(result.returned.events).toEqual([
			{
				type: "current-space:changed",
				previousSpace: 7,
				currentSpace: 0,
			},
		]);
		expect(result.same).toMatchObject({
			currentSpace: 0,
			previousSpace: 7,
		});
		expect(result.roundTrip.runtime).toMatchObject({
			currentSpace: 0,
			previousSpace: 7,
		});
		expect(result.roundTrip.events).toEqual([]);
	});

	it("resolves the return at job completion, after navigation changed since the job started", () => {
		const config = configFn(previous);
		config.items.owner!.lines[0]!.runtimeMs = 300;
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* enqueueDefaultLineFx({
					ownerItemId: "owner-live",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const started = yield* readRuntimeFx();
				yield* settleFx(
					tableFn([
						spaceFn(2),
					]),
				);
				yield* settleFx(
					tableFn([
						spaceFn(4),
					]),
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 300,
				});
				return {
					started,
					completed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.started.jobs).toHaveLength(1);
		expect(result.started.previousSpace).toBeUndefined();
		expect(result.completed.jobs).toHaveLength(0);
		expect(result.completed).toMatchObject({
			currentSpace: 2,
			previousSpace: 4,
		});
	});

	it("preserves existing history and publishes nothing when a later placement rolls the return back", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* settleFx(
					tableFn([
						spaceFn(7),
					]),
				);
				const before = yield* (yield* CommittedTransitionsFx).read;
				const rejected = yield* settleFx(
					tableFn([
						spaceFn("previous"),
						{
							...itemOutcome,
							rules: [],
						},
					]),
				).pipe(Effect.result);
				return {
					before,
					rejected,
					after: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: configFn(previous, 1),
				}),
			),
		);
		expect(Result.isFailure(result.rejected)).toBe(true);
		expect(result.after).toBe(result.before);
		expect(result.after.runtime).toMatchObject({
			currentSpace: 7,
			previousSpace: 0,
		});
	});
});
