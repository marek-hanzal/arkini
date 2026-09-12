import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { tileMotionCueTestFixture } from "~test/tile-presentation/support/tileMotionCueTestFixture";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

const { committedRuntime, readCues, runtime, source, sourceLocation, target, targetLocation } =
	tileMotionCueTestFixture;

describe("readTileMotionCuesFx", () => {
	it("compiles ordered spawn and stack facts from the complete committed transition", () => {
		const cues = Effect.runSync(
			readCues({
				sequence: 7,
				previousRuntime: runtime,
				runtime: committedRuntime,
				events: [
					{
						type: GameEventEnumSchema.enum.ItemStacked,
						itemId: target.id,
						canonicalItemId: target.item.id,
						originItemId: source.id,
						location: targetLocation,
						previousQuantity: 1,
						quantity: 2,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: target.id,
						canonicalItemId: target.item.id,
						originItemId: source.id,
						location: targetLocation,
						quantity: 1,
					},
				],
			}),
		);

		expect(cues).toEqual([
			{
				kind: "stack",
				sequence: 7,
				eventIndex: 0,
				staggerIndex: 0,
				targetActorId: target.id,
				canonicalItemId: target.item.id,
				quantity: 1,
				originActorId: source.id,
				originLocation: sourceLocation,
				targetLocation,
			},
			{
				kind: "spawn",
				sequence: 7,
				eventIndex: 1,
				staggerIndex: 1,
				actorId: target.id,
				originActorId: source.id,
				originLocation: sourceLocation,
				targetLocation,
			},
		]);
	});

	it("keeps stagger indexes local to each producer in one committed transition", () => {
		const cues = Effect.runSync(
			readCues({
				sequence: 8,
				previousRuntime: runtime,
				runtime: committedRuntime,
				events: [
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: target.id,
						canonicalItemId: target.item.id,
						originItemId: source.id,
						location: targetLocation,
						quantity: 1,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: source.id,
						canonicalItemId: source.item.id,
						originItemId: target.id,
						location: sourceLocation,
						quantity: 1,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: target.id,
						canonicalItemId: target.item.id,
						originItemId: source.id,
						location: targetLocation,
						quantity: 1,
					},
				],
			}),
		);

		expect(cues.map((cue) => cue.staggerIndex)).toEqual([
			0,
			0,
			1,
		]);
	});

	it("compiles a board input store as whole-source delivery to its live owner", () => {
		expect(
			Effect.runSync(
				readCues({
					sequence: 10,
					previousRuntime: runtime,
					runtime: committedRuntime,
					events: [
						{
							type: GameEventEnumSchema.enum.ItemInputStored,
							sourceItemId: source.id,
							canonicalItemId: source.item.id,
							previousSourceLocation: sourceLocation,
							previousQuantity: 7,
							storedQuantity: 5,
							resultingQuantity: 2,
							ownerItemId: target.id,
							lineId: "line:water",
							inputIndex: 0,
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "input",
				sequence: 10,
				eventIndex: 0,
				staggerIndex: 0,
				sourceActorId: source.id,
				targetActorId: target.id,
				canonicalItemId: source.item.id,
				previousQuantity: 7,
				storedQuantity: 5,
				resultingQuantity: 2,
				originActorId: source.id,
				originLocation: sourceLocation,
				targetLocation,
			},
		]);
	});

	it("does not invent a main-canvas origin for an Inventory input transfer", () => {
		const inventorySourceLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const previousRuntime = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === source.id
					? {
							...item,
							location: inventorySourceLocation,
							quantity: 2,
						}
					: item,
			),
		};
		const currentRuntime = {
			...previousRuntime,
			items: previousRuntime.items.map((item) =>
				item.id === source.id
					? {
							...item,
							quantity: 1,
							revision: `${item.revision}:remainder`,
						}
					: item,
			),
		};

		expect(
			Effect.runSync(
				readCues({
					sequence: 11,
					previousRuntime,
					runtime: currentRuntime,
					events: [
						{
							type: GameEventEnumSchema.enum.ItemInputStored,
							sourceItemId: source.id,
							canonicalItemId: source.item.id,
							previousSourceLocation: inventorySourceLocation,
							previousQuantity: 2,
							storedQuantity: 1,
							resultingQuantity: 1,
							ownerItemId: target.id,
							lineId: "line:water",
							inputIndex: 0,
						},
					],
				}),
			),
		).toEqual([]);
	});
	it("degrades stale or missing visual identities to no choreography", () => {
		const cues = Effect.runSync(
			readCues({
				sequence: 8,
				previousRuntime: runtime,
				runtime: committedRuntime,
				events: [
					{
						type: GameEventEnumSchema.enum.ItemStacked,
						itemId: target.id,
						canonicalItemId: "fire",
						originItemId: source.id,
						location: targetLocation,
						previousQuantity: 1,
						quantity: 3,
					},
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: "runtime:missing",
						canonicalItemId: target.item.id,
						originItemId: source.id,
						location: targetLocation,
						quantity: 1,
					},
				],
			}),
		);

		expect(cues).toEqual([]);
	});
});
