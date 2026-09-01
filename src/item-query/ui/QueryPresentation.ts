import type { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import type { ScopeSchema } from "~/item-query/schema/ScopeSchema";

export const QueryScopePresentation = {
	any: {
		description:
			"Searches the inventory, toolbar, and the current board space without a board-distance limit.",
		label: "Any local",
	},
	board: {
		description:
			"Searches matching items on the current board at the selected distance from the action owner.",
		label: "Board",
	},
	inventory: {
		description: "Searches matching items stored anywhere in the inventory.",
		label: "Inventory",
	},
	toolbar: {
		description: "Searches matching items stored anywhere in the toolbar.",
		label: "Toolbar",
	},
	universe: {
		description: "Searches the inventory, toolbar, and every board space in the current game.",
		label: "Universe",
	},
} as const satisfies Record<ScopeSchema.Type, Presentation>;

export const BoardDistancePresentation = {
	self: {
		description: "Matches only the origin itself at board distance 0.",
		label: "Self",
	},
	close: {
		description: "Matches items exactly 1 cell away, including diagonals.",
		label: "Close",
	},
	near: {
		description: "Matches items exactly 2 cells away, including diagonals.",
		label: "Near",
	},
	far: {
		description: "Matches any positive board distance and excludes only Self.",
		label: "Far",
	},
} as const satisfies Record<DistanceSchema.Type, Presentation>;

interface Presentation {
	readonly description: string;
	readonly label: string;
}
