import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/merge/support/createMergeTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

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
		const session = await createTestGameSession({
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
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
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
							space: 0,
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
				type: GameEventEnumSchema.enum.ItemMerged,
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
			await Effect.runPromise(session.disposeFx);
		}
	});
	it("publishes exact merge output placement facts after the merge outcome", async () => {
		const session = await createTestGameSession({
			config: createMergeTestConfig({
				rule: {
					target: { type: "item", itemId: "target" },
					action: "consume",
					effect: "keep",
					output: guaranteedMergeOutput(),
				},
			}),
			state: {
				cheats: { enabled: false, everEnabled: false, instantGameplay: false },
				currentSpace: 0,
				items: [
					{
						id: "runtime:source",
						itemId: "source",
						location: { scope: "inventory", position: { x: 0, y: 0 } },
						quantity: 1,
					},
					{
						id: "runtime:target",
						itemId: "target",
						location: { scope: "board", space: 0, position: { x: 1, y: 0 } },
						quantity: 1,
					},
				],
				jobs: [],
				jobQueue: [],
			},
			tickIntervalMs: 60_000,
		});
		const batches: GameEventBatchSchema.Type[] = [];
		const unsubscribe = session.subscribeEvents((batch) => batches.push(batch));

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
			const output = session.getSnapshot().items.find((item) => item.item.id === "output");
			if (output === undefined) throw new Error("Expected merge output.");

			expect(batches[0]?.events).toEqual([
				event,
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: output.id,
					canonicalItemId: "output",
					location: output.location,
					quantity: 1,
				},
			]);
		} finally {
			unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});

});
