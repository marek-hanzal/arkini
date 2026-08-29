import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";
import { useGameFx } from "~test/support/game/useGameFx";
import { startLineFx } from "~test/job/support/startLineTestFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { runTickRuntimeByFx } from "~test/support/tick/runTickRuntimeByFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
} as const;

describe("Instant gameplay", () => {
	it("settles admitted work at the shared Tick boundary while preserving the stored option", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* setInstantGameplayFx({
					enabled: true,
				});
				yield* startLineFx(startProps);
				const disabledRuntime = yield* readRuntimeFx();
				yield* setCheatEnabledFx({
					enabled: true,
				});
				const enabledRuntime = yield* readRuntimeFx();
				yield* startLineFx(startProps);
				const admittedInstantRuntime = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: TickStepMs,
				});
				const settledInstantRuntime = yield* readRuntimeFx();
				yield* setCheatEnabledFx({
					enabled: false,
				});
				const restoredTimingRuntime = yield* readRuntimeFx();
				return {
					admittedInstantRuntime,
					disabledRuntime,
					enabledRuntime,
					restoredTimingRuntime,
					settledInstantRuntime,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(),
				}),
			),
		);

		expect(result.disabledRuntime.jobs).toHaveLength(1);
		expect(result.disabledRuntime.jobs[0]?.remainingMs).toBe(1_000);
		expect(result.enabledRuntime.jobs).toEqual([]);
		expect(result.enabledRuntime.cheats).toEqual({
			enabled: true,
			everEnabled: true,
			instantGameplay: true,
		});
		expect(result.admittedInstantRuntime.jobs).toHaveLength(1);
		expect(result.admittedInstantRuntime.jobs[0]?.remainingMs).toBe(1_000);
		expect(result.settledInstantRuntime.jobs).toEqual([]);
		expect(result.restoredTimingRuntime.cheats).toEqual({
			enabled: false,
			everEnabled: true,
			instantGameplay: true,
		});
		expect(result.restoredTimingRuntime.jobs).toEqual([]);
	});

	it("changes duration rather than command validity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* setInstantGameplayFx({
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
