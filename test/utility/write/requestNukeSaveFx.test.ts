import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { requestNukeSaveFx } from "~/engine/utility/write/requestNukeSaveFx";
import { createDestructiveUtilityTestConfig } from "~test/utility/support/createDestructiveUtilityTestConfig";

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the nuke confirmation request.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

describe("requestNukeSaveFx", () => {
	it("emits one confirmation request without changing runtime or requiring an item", async () => {
		const session = await createTestGameSession({
			config: createDestructiveUtilityTestConfig(),
			tickIntervalMs: 60_000,
		});
		const batches: GameEventBatchSchema.Type[] = [];
		const unsubscribe = session.subscribeEvents((batch) => {
			batches.push(batch);
		});

		try {
			await session.run(
				spawnItemFx({
					id: "runtime:kept",
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
			const before = session.getSnapshot();
			await session.run(requestNukeSaveFx());
			await waitFor(() => batches.length === 1);

			expect(session.getSnapshot()).toBe(before);
			expect(batches[0]?.events).toEqual([
				{
					type: "nuke-save:requested",
				},
			]);
			await session.run(
				spawnItemFx({
					id: "runtime:after-cancel",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				}),
			);
			expect(session.getSnapshot().items).toHaveLength(2);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
