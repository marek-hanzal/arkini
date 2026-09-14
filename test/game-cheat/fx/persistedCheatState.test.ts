import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createTestGameSession } from "~test/support/createTestGameSession";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

const config = createJobTestConfig();

describe("persisted cheat state", () => {
	it("defaults explicitly, survives save/load and preserves options while Cheat mode is disabled", async () => {
		let saved: StateSchema.Type | undefined;
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				writeFx: (state) =>
					Effect.sync(() => {
						saved = state;
					}),
			},
		});

		try {
			expect(session.getSnapshotFn().cheats).toEqual({
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			});
			await session.runFn(
				setSpeedUpGameplayFx({
					enabled: true,
				}),
			);
			await session.runFn(
				setCheatEnabledFx({
					enabled: true,
				}),
			);
			await Effect.runPromise(session.flushSaveFx);
		} finally {
			await Effect.runPromise(session.disposeFx);
		}

		if (saved === undefined) throw new Error("Expected persisted cheat state.");
		expect(saved.cheats).toEqual({
			enabled: true,
			everEnabled: true,
			speedUpGameplay: true,
		});
		const restored = await createTestGameSession({
			config,
			state: saved,
			tickIntervalMs: 60_000,
		});
		try {
			expect(restored.getSnapshotFn().cheats).toEqual(saved.cheats);
			await restored.runFn(
				setCheatEnabledFx({
					enabled: false,
				}),
			);
			expect(restored.getSnapshotFn().cheats).toEqual({
				enabled: false,
				everEnabled: true,
				speedUpGameplay: true,
			});
		} finally {
			await Effect.runPromise(restored.disposeFx);
		}
	});
});
