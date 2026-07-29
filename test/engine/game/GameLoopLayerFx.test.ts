import { Deferred, Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { GameLoopFx } from "~/engine/game/context/GameLoopFx";
import { GameCoreLayerFx } from "~/engine/game/layer/GameCoreLayerFx";
import { GameLoopLayerFx } from "~/engine/game/layer/GameLoopLayerFx";
import { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { TickFx } from "~/engine/tick/context/TickFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";
import { createTickFailureTestConfig } from "~test/tick/support/createTickFailureTestConfig";

describe("GameLoopLayerFx", () => {
	it("does not report interruption of an in-flight Tick advance as fatal", async () => {
		let fatalFailures = 0;
		await Effect.runPromise(
			Effect.gen(function* () {
				const advanceStarted = yield* Deferred.make<void>();
				const releaseAdvance = yield* Deferred.make<void>();
				yield* Effect.scoped(
					Effect.gen(function* () {
						const loop = yield* GameLoopFx;
						yield* Deferred.await(advanceStarted);
						yield* loop.stop;
						yield* Deferred.succeed(releaseAdvance, undefined);
					}),
				).pipe(
					Effect.provide(
						GameLoopLayerFx({
							intervalMs: 1,
							onFatalError: () => {
								fatalFailures += 1;
							},
						}),
					),
					Effect.provideService(TickFx, {
						advanceRuntime: Deferred.succeed(advanceStarted, undefined).pipe(
							Effect.andThen(Deferred.await(releaseAdvance)),
						),
						advanceRuntimeBy: () => Effect.void,
						read: Effect.succeed({
							observedAtMs: 0,
							pendingElapsedMs: 0,
						}),
					}),
					Effect.provide(
						GameCoreLayerFx({
							config: createTickFailureTestConfig(),
						}),
					),
				);
			}),
		);

		expect(fatalFailures).toBe(0);
	});

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

					yield* TestClock.adjust(TickStepMs * 2 - 1);
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

		expect(result.beforeBoundary.jobs[0]?.remainingMs).toBe(TickStepMs);
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
