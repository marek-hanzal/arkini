import type { EditorItem, EditorItemType } from "~/bridge/item/editor/EditorItemModel";

export const EditorItemSectionIds = [
	"identity",
	"artwork",
	"charges",
	"merges",
	"production",
	"flow",
] as const;

export type EditorItemSectionId = (typeof EditorItemSectionIds)[number];

export type EditorItemOptionalCapability = Extract<EditorItemSectionId, "charges" | "merges">;

type EditorItemField = EditorItem extends infer Member
	? Member extends EditorItem
		? keyof Member
		: never
	: never;

/** Compile-time audit assigning every canonical top-level item field to one detail section. */
export const EditorItemFieldSections = {
	uid: "identity",
	id: "identity",
	type: "identity",
	title: "identity",
	description: "identity",
	scope: "identity",
	asset: "artwork",
	maxCount: "identity",
	maxStackSize: "identity",
	charges: "charges",
	merge: "merges",
	durationMs: "production",
	output: "production",
	maxQueueSize: "production",
	line: "production",
	lines: "production",
} as const satisfies Record<EditorItemField, EditorItemSectionId>;

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
		label: "Item",
	},
	{
		id: "artwork",
		label: "Artwork",
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
	{
		id: "flow",
		label: "Flow",
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
			case "production":
				return ProductionItemTypes.has(item.type);
			default:
				return true;
		}
	});

/** Returns only canonical sections that own editable item fields. */
export const readEditorItemFormSections = (
	item: Pick<EditorItem, "type">,
): ReadonlyArray<EditorItemSectionDescriptor> =>
	readEditorItemSections(item).filter((section) => section.id !== "flow");

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
			return "identity";
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
