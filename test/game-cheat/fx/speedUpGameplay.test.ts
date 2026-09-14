import { TickFx } from "~/game-tick/service/TickFx";
import type { TickPerformance } from "~/game-tick/type/TickPerformance";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { useGameFx } from "~test/support/useGameFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
} as const;

describe("Speed up", () => {
	it("applies the injected speed only while both switches are enabled without settling on toggle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* setSpeedUpGameplayFx({
					enabled: true,
				});
				yield* startLineFx(startProps);
				yield* runTickRuntimeByFx({
					elapsedMs: SimulationStepMs,
				});
				const disabled = yield* readRuntimeFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const enabled = yield* readRuntimeFx();
				for (let step = 0; step < 4; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: SimulationStepMs / 4,
					});
				}
				const accelerated = yield* readRuntimeFx();
				yield* setSpeedUpGameplayFx({
					enabled: false,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: SimulationStepMs,
				});
				const normal = yield* readRuntimeFx();
				yield* setSpeedUpGameplayFx({
					enabled: true,
				});
				const reenabled = yield* readRuntimeFx();
				for (let step = 0; step < 4; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: SimulationStepMs / 4,
					});
				}
				return {
					disabled,
					enabled,
					accelerated,
					normal,
					reenabled,
					completed: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
					speedUpMultiplier: 4,
				}),
			),
		);
		expect(result.disabled.jobs[0]?.remainingMs).toBe(900);
		expect(result.enabled.jobs).toBe(result.disabled.jobs);
		expect(result.accelerated.jobs[0]?.remainingMs).toBe(500);
		expect(result.normal.jobs[0]?.remainingMs).toBe(400);
		expect(result.reenabled.jobs).toBe(result.normal.jobs);
		expect(result.completed.jobs).toEqual([]);
	});

	it("publishes at accelerated boundaries and discards overdue speed-up debt", () => {
		const samples: TickPerformance[] = [];
		const result = Effect.runSync(
			Effect.gen(function* () {
				const tick = yield* TickFx;
				tick.subscribePerformanceFn(() => {
					throw new Error("Broken diagnostic sink");
				});
				const unsubscribeFn = tick.subscribePerformanceFn((sample) => samples.push(sample));
				yield* prepareJobLineFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				yield* setSpeedUpGameplayFx({
					enabled: true,
				});
				yield* startLineFx(startProps);
				yield* runTickRuntimeByFx({
					elapsedMs: 4,
				});
				const before = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 1,
				});
				const boundary = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 9000,
				});
				const delayed = yield* readRuntimeFx();
				expect(samples).toHaveLength(1);
				expect(samples[0]).toMatchObject({
					windowMs: 9005,
					wakes: 3,
					advances: 2,
					failedAdvances: 0,
					simulationBudgetMs: 200,
					droppedWallMs: 8995,
					maxWakeGapMs: 9000,
					speedMultiplier: 20,
				});
				unsubscribeFn();
				yield* runTickRuntimeByFx({
					elapsedMs: 0,
				});
				const repeated = yield* readRuntimeFx();
				yield* setSpeedUpGameplayFx({
					enabled: false,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const normal = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 1000,
				});
				expect(samples).toHaveLength(1);
				return {
					before,
					boundary,
					delayed,
					repeated,
					normal,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
					speedUpMultiplier: 20,
				}),
			),
		);
		expect(result.before.jobs[0]?.remainingMs).toBe(1000);
		expect(result.boundary.jobs[0]?.remainingMs).toBe(900);
		expect(result.delayed.jobs[0]?.remainingMs).toBe(800);
		expect(result.repeated).toBe(result.delayed);
		expect(result.normal.jobs[0]?.remainingMs).toBe(700);
	});

	it("changes duration rather than command validity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* setSpeedUpGameplayFx({
					enabled: true,
				});
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(startLineFx(startProps));
				const after = yield* readRuntimeFx();
				return {
					after,
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		expect(result.after).toEqual(result.before);
	});
});
