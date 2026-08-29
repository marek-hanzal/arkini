import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { readCommittedTileSwapMotionCueFn } from "~/ui/pixi/motion/fn/readCommittedTileSwapMotionCueFn";
import { readTileMotionCuesFx } from "~/ui/pixi/motion/readTileMotionCuesFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { useGameFx } from "~test/support/game/useGameFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { startFx } from "~/game-start/startFx";

const config = GameConfigSchema.parse({
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
		toolbarSize: 1,
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
		toolbar: [
			{
				itemId: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		],
	},
	items: {
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				default: [
					"asset:water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
		inventory: {
			uid: "inventory",
			id: "inventory",
			type: "inventory",
			title: "Inventory",
			description: "Inventory",
			asset: {
				default: [
					"asset:inventory",
				],
			},
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
const game = {
	getResourceUrl: (resourceId: string) => resourceId,
} as GameEngine;
const readCues = (transition: readTileMotionCuesFx.Props["transition"]) =>
	readTileMotionCuesFx({
		game,
		transition,
	});
const source = runtime.items.find(
	(item) => item.location.scope === "board" && item.location.position.x === 0,
);
const target = runtime.items.find(
	(item) => item.location.scope === "board" && item.location.position.x === 2,
);
const inventoryOpener = runtime.items.find((item) => item.item.id === "inventory");
if (
	source === undefined ||
	target === undefined ||
	inventoryOpener === undefined ||
	source.location.scope !== "board" ||
	target.location.scope !== "board" ||
	inventoryOpener.location.scope !== "toolbar"
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

	it.each([
		{
			label: "Board",
			openerLocation: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
		},
		{
			label: "Toolbar",
			openerLocation: inventoryOpener.location,
		},
	])("compiles one exact Inventory release from its live $label opener", ({ openerLocation }) => {
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
					: item.id === inventoryOpener.id
						? {
								...item,
								location: openerLocation,
							}
						: item,
			),
		};
		const currentRuntime = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === inventoryOpener.id
					? {
							...item,
							location: openerLocation,
						}
					: item,
			),
		};

		expect(
			Effect.runSync(
				readCues({
					sequence: 9,
					previousRuntime,
					runtime: currentRuntime,
					events: [
						{
							type: GameEventEnumSchema.enum.ItemPlaced,
							itemId: source.id,
							canonicalItemId: source.item.id,
							originItemId: inventoryOpener.id,
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
				originActorId: inventoryOpener.id,
				originLocation: openerLocation,
				targetLocation: sourceLocation,
			},
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

	it("anchors an Inventory input store to the physical toolbar opener", () => {
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
		).toMatchObject([
			{
				kind: "input",
				sequence: 11,
				eventIndex: 0,
				staggerIndex: 0,
				sourceActorId: source.id,
				sourceItem: {
					badgeCount: 2,
					id: source.id,
					itemId: source.item.id,
					itemType: "simple",
					location: inventorySourceLocation,
					quantity: 2,
					sourceUrl: "asset:water",
				},
				targetActorId: target.id,
				canonicalItemId: source.item.id,
				previousQuantity: 2,
				storedQuantity: 1,
				resultingQuantity: 1,
				originActorId: inventoryOpener.id,
				originLocation: inventoryOpener.location,
				targetLocation,
			},
		]);
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

describe("readCommittedTileSwapMotionCueFn", () => {
	it("compiles only the exchanged target half of an exact committed swap", () => {
		expect(
			readCommittedTileSwapMotionCueFn({
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
			readCommittedTileSwapMotionCueFn({
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
		).toBeNull();
	});

	it("rejects missing history, stale captured geometry, and a non-exchange", () => {
		const captured = {
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
		};
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				transition: {
					sequence: 10,
					previousRuntime: null,
					runtime: swappedRuntime,
					events: [],
				},
			}),
		).toBeNull();
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				source: {
					...captured.source,
					location: targetLocation,
				},
				transition: {
					sequence: 10,
					previousRuntime: runtime,
					runtime: swappedRuntime,
					events: [],
				},
			}),
		).toBeNull();
		expect(
			readCommittedTileSwapMotionCueFn({
				...captured,
				transition: {
					sequence: 10,
					previousRuntime: runtime,
					runtime,
					events: [],
				},
			}),
		).toBeNull();
	});
});
