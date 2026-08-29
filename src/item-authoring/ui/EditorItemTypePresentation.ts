import {
	Backpack,
	Box,
	Factory,
	Hammer,
	MapPinned,
	Mountain,
	PackageOpen,
	ScrollText,
	Timer,
	type LucideIcon,
} from "lucide-react";

import type { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Canonical editor copy and iconography for every authored item type. */
export const EditorItemTypePresentation = {
	blueprint: {
		description: "A build plan with one construction line.",
		icon: ScrollText,
	},
	craft: {
		description: "A consumable or quest-like item with one product line.",
		icon: Hammer,
	},
	deposit: {
		description: "A board resource source with optional finite production lines.",
		icon: Mountain,
	},
	inventory: {
		description: "The singleton item that opens the shared inventory.",
		icon: Backpack,
	},
	producer: {
		description: "A building or actor with one or more selectable product lines.",
		icon: Factory,
	},
	simple: {
		description: "A regular stackable item without specialized behavior.",
		icon: Box,
	},
	space: {
		description: "An immediately activated item that moves play to an authored space.",
		icon: MapPinned,
	},
	stash: {
		description: "A chest or reward container with one opening line.",
		icon: PackageOpen,
	},
	temporary: {
		description: "A board-only effect that expires after an authored duration.",
		icon: Timer,
	},
} as const satisfies Record<
	TypeSchema.Type,
	{
		readonly description: string;
		readonly icon: LucideIcon;
	}
>;
