import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

const config = createJobTestConfig();

describe("persisted cheat state", () => {
	it("defaults explicitly, survives save/load and preserves options while Cheat mode is disabled", async () => {
		let saved: StateSchema.Type | undefined;
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
			save: {
				debounceMs: 0,
				write: (state) =>
					Effect.sync(() => {
						saved = state;
					}),
			},
		});

		try {
			expect(session.getSnapshot().cheats).toEqual({
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			});
			await session.run(
				setInstantGameplayFx({
					enabled: true,
				}),
			);
			await session.run(
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
			instantGameplay: true,
		});
		const restored = await createTestGameSession({
			config,
			state: saved,
			tickIntervalMs: 60_000,
		});
		try {
			expect(restored.getSnapshot().cheats).toEqual(saved.cheats);
			await restored.run(
				setCheatEnabledFx({
					enabled: false,
				}),
			);
			expect(restored.getSnapshot().cheats).toEqual({
				enabled: false,
				everEnabled: true,
				instantGameplay: true,
			});
		} finally {
			await Effect.runPromise(restored.disposeFx);
		}
	});
});
