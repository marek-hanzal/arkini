import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { startFx } from "~/engine/start/write/startFx";
import { testArkpackConfig } from "~test/bridge/arkpack/support/createTestArkpack";

describe("fromRuntimeFx", () => {
	it("creates a detached complete state that constructs one fresh session", async () => {
		const first = await createTestGameSession({
			config: testArkpackConfig,
			tickIntervalMs: 60_000,
		});
		try {
			await first.run(startFx());
			const state = await Effect.runPromise(
				fromRuntimeFx({
					runtime: first.getSnapshot(),
				}),
			);
			await first.run(
				spawnItemFx({
					id: "runtime:later",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			expect(state.items.some(({ id }) => id === "runtime:later")).toBe(false);

			const restored = await createTestGameSession({
				config: testArkpackConfig,
				state,
				tickIntervalMs: 60_000,
			});
			try {
				expect(restored.getSnapshot().items.map(({ id }) => id)).toEqual(
					first
						.getSnapshot()
						.items.filter(({ id }) => id !== "runtime:later")
						.map(({ id }) => id),
				);
			} finally {
				await Effect.runPromise(restored.disposeWithoutSaveFx);
			}
		} finally {
			await Effect.runPromise(first.disposeWithoutSaveFx);
		}
	});
});
