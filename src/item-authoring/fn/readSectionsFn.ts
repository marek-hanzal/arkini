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
		id: "units",
		label: "Units",
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
		id: "clock",
		label: "Clock",
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
		id: "notes",
		label: "Notes",
	},
	{
		id: "delete",
		label: "Delete",
	},
] as const satisfies ReadonlyArray<SectionDescriptor>;

const ProductionItemTypes: ReadonlySet<TypeSchema.Type> = new Set([
	"common",
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
			(section.id === "estimate" ||
				section.id === "connections" ||
				section.id === "delete" ||
				section.id === "notes")
		)
			return false;
		switch (section.id) {
			case "units":
			case "merges":
				return item.type !== "inventory";
			case "production":
				return ProductionItemTypes.has(item.type);
			case "clock":
			case "action":
				return item.type === "common";
			default:
				return true;
		}
	}).map((section) =>
		section.id === "production" && item.type === "temporary"
			? {
					...section,
					label: "Temporary",
				}
			: section,
	);
