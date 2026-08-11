import { Effect } from "effect";

import type { EditorItem, EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import type { EditorItemSectionDescriptor } from "~/ui/item/editor/EditorItemSections";

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
		id: "estimate",
		label: "Estimate",
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
export const readEditorItemSectionsFx = Effect.fn("readEditorItemSectionsFx")(
	(item: Pick<EditorItem, "type">) =>
		Effect.sync(
			(): ReadonlyArray<EditorItemSectionDescriptor> =>
				EditorItemSections.filter((section) => {
					switch (section.id) {
						case "production":
							return ProductionItemTypes.has(item.type);
						default:
							return true;
					}
				}),
		),
);
