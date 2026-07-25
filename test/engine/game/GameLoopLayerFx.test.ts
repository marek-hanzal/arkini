import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { createTickFailureTestConfig } from "~test/tick/support/createTickFailureTestConfig";

describe("GameLoopLayerFx", () => {
	it("commits one producer output on the exact fixed-step completion boundary", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const owner = yield* spawnItemFx({
						id: "runtime:loop-forge",
						itemId: "forge",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},
						quantity: 1,
					});
					yield* startLineFx({
						ownerItemId: owner.id,
						lineId: "line:forge:run",
					});
					yield* Effect.yieldNow;

					yield* TestClock.adjust(199);
					const beforeBoundary = yield* readRuntimeFx();
					const transitionBeforeBoundary = yield* readCommittedTransitionFx();
					yield* TestClock.adjust(1);
					const atBoundary = yield* readRuntimeFx();
					const transitionAtBoundary = yield* readCommittedTransitionFx();

					return {
						atBoundary,
						beforeBoundary,
						transitionAtBoundary,
						transitionBeforeBoundary,
					};
				}).pipe(
					Effect.provide(
						GameSessionLayerFx({
							config: createTickFailureTestConfig(),
						}),
					),
				),
			).pipe(
				Effect.provide(
					TestClock.layer({
						warningDelay: "1 hour",
					}),
				),
			),
		);

		expect(result.beforeBoundary.jobs[0]?.remainingMs).toBe(200);
		expect(result.beforeBoundary.items.some((item) => item.item.id === "inventoryOutput")).toBe(
			false,
		);
		expect(result.atBoundary.jobs).toEqual([]);
		expect(result.atBoundary.items.some((item) => item.item.id === "inventoryOutput")).toBe(
			true,
		);
		expect(result.transitionAtBoundary.sequence).toBe(
			result.transitionBeforeBoundary.sequence + 1,
		);
		expect(result.transitionAtBoundary.runtime).toBe(result.atBoundary);
		expect(result.transitionAtBoundary.events.map((event) => event.type)).toEqual([
			GameEventEnumSchema.enum.JobCompleted,
			GameEventEnumSchema.enum.ItemSpawned,
		]);
	});
});
