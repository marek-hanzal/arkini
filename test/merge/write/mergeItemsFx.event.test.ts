import { describe, expect, it } from "vitest";

import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import { mergeItemsFx } from "~/v1/merge/write/mergeItemsFx";
import { createGameSession } from "~/v1/ui/session/createGameSession";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";

const waitFor = async (assertion: () => boolean, timeoutMs = 1_000) => {
	const startedAt = performance.now();
	while (!assertion()) {
		if (performance.now() - startedAt > timeoutMs) {
			throw new Error("Timed out while waiting for the merge event.");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};

describe("mergeItemsFx events", () => {
	it("publishes one committed item:merged event with pre-merge identities", async () => {
		const session = await createGameSession({
			config: createMergeTestConfig({
				rule: {
					target: {
						type: "item",
						itemId: "target",
					},
					action: "consume",
					effect: "replace",
					result: "result",
				},
			}),
			state: {
				items: [
					{
						id: "runtime:source",
						itemId: "source",
						location: {
							scope: "inventory",
							position: {
								x: 0,
								y: 0,
							},
						},
						quantity: 1,
					},
					{
						id: "runtime:target",
						itemId: "target",
						location: {
							scope: "board",
							position: {
								x: 1,
								y: 0,
							},
						},
						quantity: 1,
					},
				],
				jobs: [],
				jobQueue: [],
			},
			tickIntervalMs: 60_000,
		});
		const batches: GameEventBatchSchema.Type[] = [];
		const unsubscribe = session.subscribeEvents((batch) => {
			batches.push(batch);
		});

		try {
			const before = session.getSnapshot();
			const source = before.items.find((item) => item.id === "runtime:source");
			const target = before.items.find((item) => item.id === "runtime:target");
			if (source === undefined || target === undefined) {
				throw new Error("Expected merge participants.");
			}

			const event = await session.run(
				mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				}),
			);
			await waitFor(() => batches.length === 1);

			expect(event).toEqual({
				type: "item:merged",
				sourceItemId: "runtime:source",
				sourceCanonicalItemId: "source",
				targetItemId: "runtime:target",
				targetCanonicalItemId: "target",
				action: "consume",
				effect: "replace",
				resultCanonicalItemId: "result",
			});
			expect(batches[0]?.events).toEqual([
				event,
			]);
			expect(
				session.getSnapshot().items.find((item) => item.id === "runtime:target")?.item.id,
			).toBe("result");
		} finally {
			unsubscribe();
			await session.dispose();
		}
	});
});
