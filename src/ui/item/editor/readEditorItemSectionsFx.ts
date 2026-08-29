import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { Effect } from "effect";
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

const ProductionItemTypes = new Set<TypeSchema.Type>([
	"blueprint",
	"craft",
	"deposit",
	"producer",
	"stash",
	"temporary",
]);

/** Returns the explicit sections supported by one item discriminator. */
export const readEditorItemSectionsFx = Effect.fn("readEditorItemSectionsFx")(
	(item: Pick<ItemSchema.Type, "type">) =>
		Effect.sync(
			(): ReadonlyArray<EditorItemSectionDescriptor> =>
				EditorItemSections.filter((section) => {
					switch (section.id) {
						case "production":
							return ProductionItemTypes.has(item.type);
						case "action":
							return item.type === "space";
						default:
							return true;
					}
				}),
		),
);
