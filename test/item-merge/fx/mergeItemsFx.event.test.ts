import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTestGameSession } from "~test/support/game/createTestGameSession";

import type { GameSession } from "~/renderer/game/session/GameSession";
import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

const captureNextPublication = (session: GameSession) => {
	let publish:
		| ((publication: {
				readonly batch: GameEventBatchSchema.Type;
				readonly runtime: RuntimeSchema.Type;
		  }) => void)
		| undefined;
	const published = new Promise<{
		readonly batch: GameEventBatchSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}>((resolve) => {
		publish = resolve;
	});
	const unsubscribe = session.subscribeEvents((batch) => {
		publish?.({
			batch,
			runtime: session.getSnapshot(),
		});
	});
	return {
		published,
		unsubscribe,
	};
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
		const publication = captureNextPublication(session);

		try {
			const before = session.getSnapshot();
			const source = before.items.find((item) => item.id === "runtime:source");
			const target = before.items.find((item) => item.id === "runtime:target");
			if (source === undefined || target === undefined) {
				throw new Error("Expected merge participants.");
			}

			const { event } = await session.run(
				mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				}),
			);
			const published = await publication.published;

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
			expect(published.batch.events).toEqual([
				event,
			]);
			expect(
				published.runtime.items.find((item) => item.id === "runtime:target")?.item.id,
			).toBe("result");
		} finally {
			publication.unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("publishes the isolated target remainder after the stacked merge outcome", async () => {
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
						quantity: 2,
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
						quantity: 2,
					},
				],
				jobs: [],
				jobQueue: [],
			},
			tickIntervalMs: 60_000,
		});
		const publication = captureNextPublication(session);

		try {
			const before = session.getSnapshot();
			const source = before.items.find((item) => item.id === "runtime:source");
			const target = before.items.find((item) => item.id === "runtime:target");
			if (source === undefined || target === undefined) {
				throw new Error("Expected merge participants.");
			}

			const { event } = await session.run(
				mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				}),
			);
			const published = await publication.published;
			const targetRemainder = published.runtime.items.find(
				(item) => item.item.id === "target",
			);
			if (targetRemainder === undefined) {
				throw new Error("Expected isolated target remainder.");
			}

			expect(published.batch.events).toEqual([
				event,
				{
					type: GameEventEnumSchema.enum.ItemSplit,
					itemId: "runtime:target",
					canonicalItemId: "target",
					location: target.location,
					previousQuantity: 2,
					quantity: 1,
				},
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: targetRemainder.id,
					canonicalItemId: "target",
					originItemId: "runtime:target",
					location: targetRemainder.location,
					quantity: 1,
				},
			]);
		} finally {
			publication.unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("publishes exact merge output placement facts after the merge outcome", async () => {
		const session = await createTestGameSession({
			config: createMergeTestConfig({
				rule: {
					target: {
						type: "item",
						itemId: "target",
					},
					action: "consume",
					effect: "keep",
					output: guaranteedMergeOutput(),
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
		const publication = captureNextPublication(session);

		try {
			const before = session.getSnapshot();
			const source = before.items.find((item) => item.id === "runtime:source");
			const target = before.items.find((item) => item.id === "runtime:target");
			if (source === undefined || target === undefined) {
				throw new Error("Expected merge participants.");
			}

			const { event } = await session.run(
				mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				}),
			);
			const published = await publication.published;
			const output = published.runtime.items.find((item) => item.item.id === "output");
			if (output === undefined) throw new Error("Expected merge output.");

			expect(published.batch.events).toEqual([
				event,
				{
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: output.id,
					canonicalItemId: "output",
					originItemId: "runtime:target",
					location: output.location,
					quantity: 1,
				},
			]);
		} finally {
			publication.unsubscribe();
			await Effect.runPromise(session.disposeFx);
		}
	});
});
