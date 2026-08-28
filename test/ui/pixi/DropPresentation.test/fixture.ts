import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { SwapCandidate } from "~/ui/pixi/drop/DropPresentation";

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

export const targetLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 1,
		y: 0,
	},
};

export const swapCandidate = {
	source: {
		id: "runtime:source",
		location: sourceLocation,
		revision: "revision:source",
	},
	target: {
		id: "runtime:target",
		location: targetLocation,
		revision: "revision:target",
	},
} satisfies SwapCandidate;

export const moveResult = {
	itemId: swapCandidate.source.id,
	kind: "move",
	location: targetLocation,
	previousLocation: sourceLocation,
	revision: "revision:moved",
} satisfies runTileDropAtom.Result;

export const swapResult = {
	kind: "swap",
	source: {
		itemId: swapCandidate.source.id,
		location: targetLocation,
		previousLocation: sourceLocation,
		revision: "revision:source-swapped",
	},
	target: {
		itemId: swapCandidate.target.id,
		location: sourceLocation,
		previousLocation: targetLocation,
		revision: "revision:target-swapped",
	},
} satisfies runTileDropAtom.Result;
