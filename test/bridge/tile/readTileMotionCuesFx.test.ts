import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readCommittedTileSwapMotionCueFx } from "~/bridge/tile/motion/readCommittedTileSwapMotionCueFx";
import { readTileMotionCuesFx } from "~/bridge/tile/motion/readTileMotionCuesFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:tile-motion-cues",
		title: "Tile motion cues",
		board: {
			width: 3,
			height: 1,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "water",
				space: 0,
				x: 0,
				y: 0,
			},
			{
				itemId: "water",
				space: 0,
				x: 2,
				y: 0,
			},
		],
	},
	categories: {},
	items: {
		water: {
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				source: [
					"asset:water",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const runtime = Effect.runSync(
	startFx().pipe(
		useGameFx({
			config,
		}),
	),
);
const source = runtime.items.find(
	(item) => item.location.scope === "board" && item.location.position.x === 0,
);
const target = runtime.items.find(
	(item) => item.location.scope === "board" && item.location.position.x === 2,
);
if (
	source === undefined ||
	target === undefined ||
	source.location.scope !== "board" ||
	target.location.scope !== "board"
) {
	throw new Error("Tile motion cue fixture is missing its board actors.");
}
const sourceLocation = source.location;
const targetLocation = target.location;
const committedRuntime = {
	...runtime,
	items: runtime.items.map((item) =>
		item.id === target.id
			? {
					...item,
					quantity: 2,
				}
			: item,
	),
};

describe("readTileMotionCuesFx", () => {
	it("compiles ordered spawn and stack facts from the complete committed transition", () => {
		const cues = Effect.runSync(
			readTileMotionCuesFx({
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
			readTileMotionCuesFx({
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

	it("compiles one exact Inventory release as retained actor motion", () => {
		const inventoryLocation = {
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
							location: inventoryLocation,
						}
					: item,
			),
		};

		expect(
			Effect.runSync(
				readTileMotionCuesFx({
					sequence: 9,
					previousRuntime,
					runtime,
					events: [
						{
							type: GameEventEnumSchema.enum.ItemPlaced,
							itemId: source.id,
							canonicalItemId: source.item.id,
							originItemId: source.id,
							previousLocation: inventoryLocation,
							location: sourceLocation,
							quantity: source.quantity,
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "spawn",
				sequence: 9,
				eventIndex: 0,
				staggerIndex: 0,
				actorId: source.id,
				originActorId: source.id,
				originLocation: inventoryLocation,
				targetLocation: sourceLocation,
			},
		]);
	});

	it("degrades stale or missing visual identities to no choreography", () => {
		const cues = Effect.runSync(
			readTileMotionCuesFx({
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

const swappedRuntime = {
	...runtime,
	items: runtime.items.map((item) =>
		item.id === source.id
			? {
					...item,
					location: targetLocation,
					revision: `${item.revision}:swapped`,
				}
			: item.id === target.id
				? {
						...item,
						location: sourceLocation,
						revision: `${item.revision}:swapped`,
					}
				: item,
	),
};

describe("readCommittedTileSwapMotionCueFx", () => {
	it("compiles only the exchanged target half of an exact committed swap", () => {
		expect(
			Effect.runSync(
				readCommittedTileSwapMotionCueFx({
					source: {
						id: source.id,
						revision: source.revision,
						location: sourceLocation,
					},
					target: {
						id: target.id,
						revision: target.revision,
						location: targetLocation,
					},
					transition: {
						sequence: 9,
						previousRuntime: runtime,
						runtime: swappedRuntime,
						events: [],
					},
				}),
			),
		).toEqual({
			kind: "swap",
			sequence: 9,
			eventIndex: 0,
			staggerIndex: 0,
			actorId: target.id,
			counterpartActorId: source.id,
			originActorId: target.id,
			originLocation: targetLocation,
			targetLocation: sourceLocation,
		});
	});

	it("rejects a stale captured identity instead of animating an unrelated commit", () => {
		expect(
			Effect.runSync(
				readCommittedTileSwapMotionCueFx({
					source: {
						id: source.id,
						revision: "revision:stale",
						location: sourceLocation,
					},
					target: {
						id: target.id,
						revision: target.revision,
						location: targetLocation,
					},
					transition: {
						sequence: 9,
						previousRuntime: runtime,
						runtime: swappedRuntime,
						events: [],
					},
				}),
			),
		).toBeNull();
	});
});
