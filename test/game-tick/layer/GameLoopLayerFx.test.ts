import { TickLayerFx } from "~/game-tick/layer/TickLayerFx";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { Deferred, Effect } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "@effect/vitest";

import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { GameLoopFx } from "~/game-tick/service/GameLoopFx";
import { GameLoopLayerFx } from "~/game-tick/layer/GameLoopLayerFx";
import { GameSessionLayerFx } from "~/game-session/layer/GameSessionLayerFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { GameRuntimeLayerFx } from "~/game-runtime/layer/GameRuntimeLayerFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { TickFx } from "~/game-tick/service/TickFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { createTickFailureTestConfig } from "~test/game-tick/support/createTickFailureTestConfig";

describe("GameLoopLayerFx", () => {
	it.effect("does not report interruption of an in-flight Tick advance as fatal", () => {
		let fatalFailures = 0;
		return Effect.gen(function* () {
			const advanceStarted = yield* Deferred.make<void>();
			const releaseAdvance = yield* Deferred.make<void>();
			yield* Effect.gen(function* () {
				const loop = yield* GameLoopFx;
				yield* Deferred.await(advanceStarted);
				yield* loop.stop;
				yield* Deferred.succeed(releaseAdvance, undefined);
			}).pipe(
				Effect.provide(
					GameLoopLayerFx({
						intervalMs: 1,
						onFatalErrorFn: () => {
							fatalFailures += 1;
						},
					}),
				),
				Effect.provideService(TickFx, {
					subscribePerformanceFn: () => () => undefined,
					advanceRuntime: Deferred.succeed(advanceStarted, undefined).pipe(
						Effect.andThen(Deferred.await(releaseAdvance)),
						Effect.as(1),
					),
				}),
				Effect.provide(
					GameRuntimeLayerFx({
						config: createTickFailureTestConfig(),
					}),
				),
			);

			expect(fatalFailures).toBe(0);
		});
	});

	it.effect("schedules individual accelerated steps at five-millisecond wall boundaries", () =>
		Effect.gen(function* () {
			yield* spawnItemFx({
				id: "runtime:loop-forge",
				itemUid: "forge",

				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			});
			yield* setCheatEnabledFx({
				enabled: true,
			});
			yield* setSpeedUpGameplayFx({
				enabled: true,
			});
			yield* startLineFx({
				ownerItemId: "runtime:loop-forge",
				lineId: "line:forge:run",
			});
			yield* Effect.gen(function* () {
				yield* TestClock.adjust(9);
				const before = yield* readRuntimeFx();
				yield* TestClock.adjust(1);
				const after = yield* readRuntimeFx();
				expect(before.jobs[0]?.remainingMs).toBe(100);
				expect(after.jobs).toEqual([]);
				expect(after.items.some((item) => item.item.uid === "completionOutput")).toBe(true);
			}).pipe(
				Effect.provide(GameLoopLayerFx()),
				Effect.provide(
					TickLayerFx({
						speedUpMultiplier: 20,
					}),
				),
			);
		}).pipe(
			Effect.provide(
				GameRuntimeLayerFx({
					config: createTickFailureTestConfig(),
				}),
			),
		),
	);

	it.effect("commits one producer outcome on the exact fixed-step completion boundary", () =>
		Effect.gen(function* () {
			const owner = yield* spawnItemFx({
				id: "runtime:loop-forge",
				itemUid: "forge",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			});
			yield* startLineFx({
				ownerItemId: owner.id,
				lineId: "line:forge:run",
			});
			yield* Effect.yieldNow;

			yield* TestClock.adjust(SimulationStepMs * 2 - 1);
			const beforeBoundary = yield* readRuntimeFx();
			const transitionBeforeBoundary = yield* (yield* CommittedTransitionsFx).read;
			yield* TestClock.adjust(1);
			const atBoundary = yield* readRuntimeFx();
			const transitionAtBoundary = yield* (yield* CommittedTransitionsFx).read;

			expect(beforeBoundary.jobs[0]?.remainingMs).toBe(SimulationStepMs);
			expect(beforeBoundary.items.some((item) => item.item.uid === "completionOutput")).toBe(
				false,
			);
			expect(atBoundary.jobs).toEqual([]);
			expect(atBoundary.items.some((item) => item.item.uid === "completionOutput")).toBe(
				true,
			);
			expect(transitionAtBoundary.sequence).toBe(transitionBeforeBoundary.sequence + 1);
			expect(transitionAtBoundary.runtime).toBe(atBoundary);
			expect(transitionAtBoundary.events.map((event) => event.type)).toEqual([
				GameEventEnumSchema.enum.JobCompleted,
				GameEventEnumSchema.enum.ItemSpawned,
			]);
		}).pipe(
			Effect.provide(
				GameSessionLayerFx({
					config: createTickFailureTestConfig(),
				}),
			),
		),
	);
});
