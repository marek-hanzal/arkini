import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { SectionDescriptor } from "~/item-authoring/type/Section";

const Sections = [
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
		id: "connections",
		label: "Connections",
	},
	{
		id: "delete",
		label: "Delete",
	},
] as const satisfies ReadonlyArray<SectionDescriptor>;

const ProductionItemTypes: ReadonlySet<TypeSchema.Type> = new Set([
	"blueprint",
	"craft",
	"deposit",
	"producer",
	"stash",
	"temporary",
]);

/** Returns the explicit sections supported by one item discriminator and surface. */
export const readSectionsFn = (
	item: Pick<ItemSchema.Type, "type">,
	mode: "detail" | "form" = "detail",
): ReadonlyArray<SectionDescriptor> =>
	Sections.filter((section) => {
		if (
			mode === "form" &&
			(section.id === "estimate" || section.id === "connections" || section.id === "delete")
		)
			return false;
		switch (section.id) {
			case "charges":
			case "merges":
				return item.type !== "inventory";
			case "production":
				return ProductionItemTypes.has(item.type);
			case "action":
				return item.type === "space";
			default:
				return true;
		}
	});
