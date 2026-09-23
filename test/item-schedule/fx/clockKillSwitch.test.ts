import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { projectCommittedEngineFactsFx } from "~/game-event/fx/projectCommittedEngineFactsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { expireItemRuntimeFx } from "~/item-expiry/fx/expireItemRuntimeFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import {
	createLine,
	createOutput,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { createClockConfig, spawnClockItemFx } from "./clockSchedule.test/fixture";

const configFn = (mode: "kill-switch" | "loose-kill", runtimeMs = 100) => {
	const config = createClockConfig({
		lines: [
			{
				...createLine({
					uid: "a",
					clock: true,
					default: true,
					outcome: createOutput([
						{
							itemUid: "result",
						},
					]),
				}),
				runtimeMs,
			},
		],
		clock: {
			expiryMode: mode,
			durationMs: 100,
			intervalMs: 100,
			onExpire: createOutput([
				{
					itemUid: "expired",
				},
				{
					itemUid: "expired",
				},
				{
					itemUid: "expired",
				},
			]),
		},
	});
	return {
		...config,
		items: {
			...config.items,
			result: {
				...config.items.result!,
			},
		},
	};
};

const fillBoardFx = Effect.fn("fillKillTestBoardFx")(function* () {
	for (let n = 1; n < 12; n++)
		yield* spawnItemFx({
			id: `blocker:${n}`,
			itemUid: "permit",

			location: {
				scope: "board",
				space: 0,
				position: {
					x: n % 6,
					y: Math.floor(n / 6),
				},
			},
		});
});

const advanceWithEventsFx = Effect.fn("advanceKillTestStepFx")(function* (
	previousRuntime: RuntimeSchema.Type,
) {
	const step = yield* advanceRuntimeStepFx(previousRuntime);
	return {
		runtime: step.runtime,
		events: yield* projectCommittedEngineFactsFx({
			previousRuntime,
			runtime: step.runtime,
			facts: step.facts,
		}),
	};
});

describe("Clock kill switch", () => {
	it.each([
		"kill-switch",
		"loose-kill",
	] as const)("settles a full-board blocked job according to %s", (mode) => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* startLineFx({
					ownerItemId: "runtime:clock",
					lineUid: "a",
				});
				yield* fillBoardFx();
				const before = yield* readRuntimeFx();
				const step = yield* advanceWithEventsFx(before);
				return {
					before,
					step,
				};
			}).pipe(
				useGameFx({
					config: configFn(mode),
				}),
			),
		);
		if (mode === "loose-kill") {
			expect(result.step.runtime.jobs).toHaveLength(1);
			expect(result.step.runtime.items.some((item) => item.id === "runtime:clock")).toBe(
				true,
			);
			expect(result.step.events).toEqual([
				expect.objectContaining({
					type: "job:queued",
					ownerItemId: "runtime:clock",
					lineUid: "a",
				}),
			]);
		} else {
			expect(result.step.runtime.jobs).toEqual([]);
			expect(result.step.runtime.jobQueue).toEqual([]);
			expect(result.step.runtime.items.some((item) => item.id === "runtime:clock")).toBe(
				false,
			);
			expect(
				result.step.runtime.items.filter((item) => item.item.uid === "expired"),
			).toHaveLength(1);
			expect(result.step.runtime.items.some((item) => item.item.uid === "result")).toBe(
				false,
			);
			expect(result.step.events).toContainEqual(
				expect.objectContaining({
					type: "job:aborted",
					reason: "owner-removed",
				}),
			);
			const losses = result.step.events.filter((event) => event.type === "item:discarded");
			expect(losses).toHaveLength(2);
			expect(losses).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						source: "expiry-outcome",
						quantity: 1,
						reason: "board:full",
					}),
				]),
			);
		}
		// Planning never publishes or mutates the supplied snapshot.
		expect(result.before.jobs[0]?.remainingMs).toBe(100);
		expect(result.before.items.some((item) => item.id === "runtime:clock")).toBe(true);
	});

	it("lets a completion at the expiry boundary win but starts no final Clock pulse or queued successor", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* startLineFx({
					ownerItemId: "runtime:clock",
					lineUid: "a",
				});
				const before = yield* readRuntimeFx();
				const previousRuntime = {
					...before,
					jobQueue: [
						{
							id: "queued",
							ownerItemId: "runtime:clock",
							lineUid: "a",
						},
					],
				};
				return yield* advanceWithEventsFx(previousRuntime);
			}).pipe(
				useGameFx({
					config: configFn("kill-switch"),
				}),
			),
		);
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([]);
		expect(result.runtime.items.filter((item) => item.item.uid === "result")).toHaveLength(1);
		expect(result.events.filter((event) => event.type === "job:completed")).toHaveLength(1);
		expect(
			result.events.some(
				(event) => event.type === "job:started" || event.type === "job:aborted",
			),
		).toBe(false);
	});

	it("cancels unfinished work at expiry rather than waiting for its duration", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* startLineFx({
					ownerItemId: "runtime:clock",
					lineUid: "a",
				});
				return yield* advanceWithEventsFx(yield* readRuntimeFx());
			}).pipe(
				useGameFx({
					config: configFn("kill-switch", 1000),
				}),
			),
		);
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.item.uid === "result")).toBe(false);
		expect(result.events.filter((event) => event.type === "job:aborted")).toHaveLength(1);
	});

	it("rolls back removal and cancelled work when expiry outcome fails for a non-capacity reason", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				yield* startLineFx({
					ownerItemId: owner.id,
					lineUid: "a",
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					modifyRuntimeFx((runtime) =>
						Effect.gen(function* () {
							const removed = yield* expireItemRuntimeFx({
								item: owner,
								origin: {
									scope: "board",
									space: 0,
									position: {
										x: 0,
										y: 0,
									},
								},
								removalMode: "kill-switch",
								outcome: createOutput([
									{
										itemUid: "missing-outcome",
									},
								]),
								randomSeed: "rollback",
								runtime,
							});
							return [
								undefined,
								removed.runtime,
								removed.facts,
							] as const;
						}),
					),
				);
				return {
					attempt,
					before,
					after: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: configFn("kill-switch"),
				}),
			),
		);
		expect(Result.isFailure(result.attempt)).toBe(true);
		expect(result.after).toEqual(result.before);
	});
});
