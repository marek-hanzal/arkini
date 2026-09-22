import type { DistanceSchema } from "~/item-location/schema/DistanceSchema";

export const BoardDistancePresentation = {
	self: {
		description: "Matches only the origin itself at board distance 0.",
		label: "Self",
	},
	close: {
		description: "Matches items exactly 1 cell away, including diagonals.",
		label: "Close",
	},
	"near-close": {
		description: "Matches items 1 or 2 cells away, including diagonals, but excludes Self.",
		label: "Near-Close",
	},
	near: {
		description: "Matches items exactly 2 cells away, including diagonals.",
		label: "Near",
	},
	far: {
		description: "Matches any positive board distance and excludes only Self.",
		label: "Far",
	},
	universe: {
		description: "Searches matching items in every board space in the current game.",
		label: "Universe",
	},
} as const satisfies Record<DistanceSchema.Type, Presentation>;

interface Presentation {
	readonly description: string;
	readonly label: string;
}
