import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { startFx } from "~/game-start/fx/startFx";
import { testArkpackConfig } from "~test/arkpack-support/fx/createTestArkpack";

describe("fromRuntimeFn", () => {
	it("creates a detached complete state that constructs one fresh session", async () => {
		const first = await createTestGameSession({
			config: testArkpackConfig,
			tickIntervalMs: 60_000,
		});
		try {
			await first.runFn(startFx());
			const state = fromRuntimeFn({
				runtime: first.getSnapshotFn(),
			});
			expect(state.items[0]).not.toHaveProperty("remainingCharges");
			expect(state.items[0]).not.toHaveProperty("remainingDurationMs");
			await first.runFn(
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
				expect(restored.getSnapshotFn().items.map(({ id }) => id)).toEqual(
					first
						.getSnapshotFn()
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
