import type { EditorItem, EditorItemType } from "~/bridge/item/editor/EditorItemModel";

export const EditorItemSectionIds = [
	"identity",
	"artwork",
	"limits",
	"charges",
	"merges",
	"production",
] as const;

export type EditorItemSectionId = (typeof EditorItemSectionIds)[number];

export const parseEditorItemSectionId = (candidate: string): EditorItemSectionId => {
	const section = EditorItemSectionIds.find((id) => id === candidate);
	if (section === undefined) throw new Error(`Unknown editor item section ${candidate}.`);
	return section;
};

export interface EditorItemSectionDescriptor {
	readonly id: EditorItemSectionId;
	readonly label: string;
}

const EditorItemSections = [
	{
		id: "identity",
		label: "Identity",
	},
	{
		id: "artwork",
		label: "Artwork",
	},
	{
		id: "limits",
		label: "Limits",
	},
	{
		id: "charges",
		label: "Charges",
	},
	{
		id: "merges",
		label: "Merges",
	},
	{
		id: "production",
		label: "Production",
	},
] as const satisfies ReadonlyArray<EditorItemSectionDescriptor>;

const ProductionItemTypes = new Set<EditorItemType>([
	"blueprint",
	"craft",
	"deposit",
	"producer",
	"stash",
	"temporary",
]);

/** Returns the explicit sections supported by one item discriminator. */
export const readEditorItemSections = (
	item: Pick<EditorItem, "type">,
): ReadonlyArray<EditorItemSectionDescriptor> =>
	EditorItemSections.filter((section) => {
		switch (section.id) {
			case "limits":
				return item.type !== "inventory";
			case "production":
				return ProductionItemTypes.has(item.type);
			default:
				return true;
		}
	});

/** Maps one canonical item-schema path to its route-owned form section. */
export const readEditorItemSectionForPath = (
	path: ReadonlyArray<PropertyKey>,
): EditorItemSectionId => {
	const root = path[0];
	switch (root) {
		case "asset":
			return "artwork";
		case "maxCount":
		case "maxStackSize":
			return "limits";
		case "charges":
			return "charges";
		case "merge":
			return "merges";
		case "durationMs":
		case "line":
		case "lines":
		case "maxQueueSize":
		case "output":
			return "production";
		default:
			return "identity";
	}
};
