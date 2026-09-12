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

/** Returns the explicit sections supported by the item surface. */
export const readSectionsFn = (
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
		return true;
	});
