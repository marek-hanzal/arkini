import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";

/** Canonical editor copy and iconography for every authored item type. */
export const EditorItemTypePresentation = {
	blueprint: {
		description: "A build plan with one construction line.",
		icon: "icon-[lucide--scroll-text]",
	},
	craft: {
		description: "A consumable or quest-like item with one product line.",
		icon: "icon-[lucide--hammer]",
	},
	deposit: {
		description: "A board resource source with optional finite production lines.",
		icon: "icon-[lucide--mountain]",
	},
	inventory: {
		description: "The singleton item that opens the shared inventory.",
		icon: "icon-[lucide--backpack]",
	},
	producer: {
		description: "A building or actor with one or more selectable product lines.",
		icon: "icon-[lucide--factory]",
	},
	simple: {
		description: "A regular stackable item without specialized behavior.",
		icon: "icon-[lucide--box]",
	},
	space: {
		description: "An immediately activated item that moves play to an authored space.",
		icon: "icon-[lucide--map-pinned]",
	},
	stash: {
		description: "A chest or reward container with one opening line.",
		icon: "icon-[lucide--package-open]",
	},
	temporary: {
		description: "A board-only effect that expires after an authored duration.",
		icon: "icon-[lucide--timer]",
	},
} as const satisfies Record<
	EditorItemType,
	{
		readonly description: string;
		readonly icon: string;
	}
>;
