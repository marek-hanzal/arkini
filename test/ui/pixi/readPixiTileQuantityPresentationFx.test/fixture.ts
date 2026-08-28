import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { TileMotionCue } from "~/bridge/tile/motion/TileMotionCue";

export const quantityLocation = {
	position: {
		x: 0,
		y: 0,
	},
	scope: "inventory",
} satisfies TileActorItem["location"];

export const stackCue = {
	canonicalItemId: "item",
	eventIndex: 0,
	kind: "stack",
	originActorId: "runtime:producer",
	originLocation: quantityLocation,
	quantity: 1,
	sequence: 1,
	staggerIndex: 0,
	targetActorId: "runtime:item",
	targetLocation: quantityLocation,
} satisfies TileMotionCue;

export const inputCue = {
	canonicalItemId: "item",
	eventIndex: 0,
	kind: "input",
	originActorId: "runtime:item",
	originLocation: quantityLocation,
	previousQuantity: 6,
	resultingQuantity: 4,
	sequence: 2,
	sourceActorId: "runtime:item",
	staggerIndex: 0,
	storedQuantity: 2,
	targetActorId: "runtime:owner",
	targetLocation: quantityLocation,
} satisfies TileMotionCue;
