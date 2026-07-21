import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/job/support/jobTestConfig";

const startProps = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
} as const;

describe("Instant gameplay", () => {
	it("settles existing and newly started valid work while preserving the stored option", () => {
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
				yield* setCheatEnabledFx({
					enabled: false,
				});
				yield* startLineFx(startProps);
				const restoredTimingRuntime = yield* readRuntimeFx();
				return {
					disabledRuntime,
					enabledRuntime,
					restoredTimingRuntime,
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
		expect(result.restoredTimingRuntime.cheats).toEqual({
			enabled: false,
			everEnabled: true,
			instantGameplay: true,
		});
		expect(result.restoredTimingRuntime.jobs).toHaveLength(1);
		expect(result.restoredTimingRuntime.jobs[0]?.remainingMs).toBe(1_000);
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
				const attempt = yield* Effect.either(startLineFx(startProps));
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

		expect(Either.isLeft(result.attempt)).toBe(true);
		expect(result.after).toEqual(result.before);
	});
});
