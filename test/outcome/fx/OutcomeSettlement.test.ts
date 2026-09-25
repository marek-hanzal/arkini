import {
	origin,
	itemOutcome,
	tableFn,
	spaceFn,
	configFn,
	spawnOwnerFx,
	settleFx,
} from "./OutcomeSettlement.test/fixture";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { enqueueDefaultLineFx } from "~/production-job/fx/enqueueDefaultLineFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { settleTerminalItemRuntimeFx } from "~/item-terminal/fx/settleTerminalItemRuntimeFx";

describe("Outcome settlement", () => {
	it("retains the complete mixed roll and owner origin while only publishing the last Space", () => {
		const outcome = tableFn([
			spaceFn(1),
			{
				...itemOutcome,
				rules: [],
			},
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const resolved = yield* resolveOutcomeTableFx({
					ownerItemId: "test-outcome-owner",
					origin,
					outcome,
				});
				yield* settleFx(outcome);
				return {
					resolved,
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.resolved.roll).toEqual([
			{
				origin,
				outcome: [
					{
						type: "space",
						space: 1,
					},
					{
						type: "item",
						itemUid: "reward",
						quantity: 1,
						placement: "drop",
					},
					{
						type: "space",
						space: 2,
					},
				],
			},
		]);
		expect(result.transition.runtime.currentSpace).toBe(2);
		expect(result.transition.runtime.previousSpace).toBe(0);
		expect(
			result.transition.runtime.items.find((item) => item.item.uid === "reward")?.location,
		).toMatchObject({
			scope: "board",
			space: 0,
		});
		expect(result.transition.events).toEqual([
			{
				type: "current-space:changed",
				previousSpace: 0,
				currentSpace: 2,
			},
		]);
	});

	it("rolls navigation back with failed item placement, including repeated retries", () => {
		const outcome = tableFn([
			spaceFn(1),
			{
				...itemOutcome,
				rules: [],
			},
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				const before = yield* readRuntimeFx();
				const first = yield* settleFx(outcome).pipe(Effect.result);
				const second = yield* settleFx(outcome).pipe(Effect.result);
				return {
					before,
					after: yield* readRuntimeFx(),
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config: configFn(outcome, 1),
				}),
			),
		);
		expect(Result.isFailure(result.first)).toBe(true);
		expect(Result.isFailure(result.second)).toBe(true);
		expect(result.after).toEqual(result.before);
	});

	it("uses the ordinary default queue and completes Space from a non-current Board", () => {
		const outcome = tableFn([
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* enqueueDefaultLineFx({
					ownerItemId: "owner-live",
				});
				const queued = yield* readRuntimeFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						{
							...runtime,
							currentSpace: 1,
						},
					] as const),
				);
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					queued,
					after: yield* readRuntimeFx(),
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.queued.currentSpace).toBe(0);
		expect(result.queued.jobQueue).toHaveLength(1);
		expect(result.queued.jobs).toHaveLength(0);
		expect(result.after.currentSpace).toBe(2);
		expect(result.after.jobQueue).toHaveLength(0);
		expect(result.after.jobs).toHaveLength(0);
		expect(
			result.transition.events.filter((event) => event.type === "current-space:changed"),
		).toEqual([
			{
				type: "current-space:changed",
				previousSpace: 1,
				currentSpace: 2,
			},
		]);
	});

	it("Space-only expiry still reports disappearance and uses the captured removed-owner origin", () => {
		const outcome = tableFn([
			spaceFn(2),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnOwnerFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.gen(function* () {
						const expired = yield* settleTerminalItemRuntimeFx({
							cause: "expired",
							item: owner,
							origin,
							outcome,
							randomSeed: "expiry",
							runtime,
						});
						return [
							undefined,
							expired.runtime,
							expired.facts,
						] as const;
					}),
				);
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.runtime.items).toHaveLength(0);
		expect(result.runtime.currentSpace).toBe(2);
		expect(result.events.map((event) => event.type)).toContain("item:disappeared");
	});

	it("reports disappearance when a later template erases the expiry Item output", () => {
		const outcome = tableFn([
			{
				...itemOutcome,
				rules: [],
			},
			{
				type: "template",
				templateUid: "empty",
				rules: [],
			},
		]);
		const config = {
			...configFn(outcome),
			templates: [
				{
					uid: "empty",
					title: "Empty",
					width: 3,
					height: 1,
					board: [],
				},
			],
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnOwnerFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.gen(function* () {
						const expired = yield* settleTerminalItemRuntimeFx({
							cause: "expired",
							item: owner,
							origin,
							outcome,
							randomSeed: "expiry-template",
							runtime,
						});
						return [
							undefined,
							expired.runtime,
							expired.facts,
						] as const;
					}),
				);
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.items).toHaveLength(0);
		expect(result.events.map((event) => event.type)).toContain("board:template-applied");
		expect(result.events.map((event) => event.type)).toContain("item:disappeared");
		expect(result.events.map((event) => event.type)).not.toContain("item:spawned");
		expect(
			result.events.some(
				(event) => event.type === "item:removed" && event.snapshot.item.uid === "reward",
			),
		).toBe(false);
	});

	it("does not publish a round-trip Space event or apply rejected Space outcomes", () => {
		const outcome = tableFn([
			spaceFn(2),
			{
				type: "space",
				space: 3,
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
									distance: "far",
									selector: {
										type: "item",
										itemUid: "reward",
									},
								},
							},
						],
					},
				],
			},
			spaceFn(0),
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* settleFx(outcome);
				return yield* (yield* CommittedTransitionsFx).read;
			}).pipe(
				useGameFx({
					config: configFn(outcome),
				}),
			),
		);
		expect(result.runtime.currentSpace).toBe(0);
		expect(result.runtime.previousSpace).toBeUndefined();
		expect(result.events.filter((event) => event.type === "current-space:changed")).toEqual([]);
	});
});
