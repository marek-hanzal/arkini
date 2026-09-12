import { Effect } from "effect";

import { readTileMotionCuesFn } from "~/tile-presentation/fn/readTileMotionCuesFn";
import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { startFx } from "~/game-start/fx/startFx";

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
			maxQueueSize: 1,
			lines: [],

			uid: "water",
			id: "water",

			title: "Water",
			description: "Water",
			asset: {
				scale: 0.8,
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
			action: {
				type: "inventory",
			},
			scope: "any",
			maxStackSize: 1,
			title: "Inventory",
			description: "Inventory",
			asset: {
				scale: 0.8,
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

export const tileMotionCueTestFixture = {
	committedRuntime,
	inventoryOpener,
	readCues: (transition: Parameters<typeof readTileMotionCuesFn>[0]["transition"]) =>
		Effect.succeed(
			readTileMotionCuesFn({
				transition,
			}),
		),
	runtime,
	source,
	sourceLocation,
	swappedRuntime,
	target,
	targetLocation,
};
