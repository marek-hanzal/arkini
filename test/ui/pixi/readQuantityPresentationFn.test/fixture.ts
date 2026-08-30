import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { TileMotionCue } from "~/tile-presentation/type/TileMotionCue";

export const cueLocation = {
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
	originLocation: cueLocation,
	quantity: 1,
	sequence: 1,
	staggerIndex: 0,
	targetActorId: "runtime:item",
	targetLocation: cueLocation,
} satisfies TileMotionCue;

export const inputCue = {
	canonicalItemId: "item",
	eventIndex: 0,
	kind: "input",
	originActorId: "runtime:item",
	originLocation: cueLocation,
	previousQuantity: 6,
	resultingQuantity: 4,
	sequence: 2,
	sourceActorId: "runtime:item",
	staggerIndex: 0,
	storedQuantity: 2,
	targetActorId: "runtime:owner",
	targetLocation: cueLocation,
} satisfies TileMotionCue;
