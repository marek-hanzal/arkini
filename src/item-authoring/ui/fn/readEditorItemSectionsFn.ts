import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { EditorItemSectionDescriptor } from "~/item-authoring/ui/EditorItemSections";

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
		id: "action",
		label: "Action",
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
		id: "delete",
		label: "Delete",
	},
] as const satisfies ReadonlyArray<EditorItemSectionDescriptor>;

const ProductionItemTypes: ReadonlySet<TypeSchema.Type> = new Set([
	"blueprint",
	"craft",
	"deposit",
	"producer",
	"stash",
	"temporary",
]);

/** Returns the explicit sections supported by one item discriminator. */
export const readEditorItemSectionsFn = (
	item: Pick<ItemSchema.Type, "type">,
): ReadonlyArray<EditorItemSectionDescriptor> =>
	EditorItemSections.filter((section) => {
		switch (section.id) {
			case "production":
				return ProductionItemTypes.has(item.type);
			case "action":
				return item.type === "space";
			default:
				return true;
		}
	});
