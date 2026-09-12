import type { SectionDescriptor } from "~/item-authoring/type/Section";

const FormSections = [
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
] as const satisfies ReadonlyArray<SectionDescriptor>;

const DetailSections = [
	{
		id: "identity",
		label: "Item",
	},
	{
		id: "interactions",
		label: "Interactions",
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
] as const satisfies ReadonlyArray<SectionDescriptor>;

/** Detail groups related capabilities; authoring retains exact validation destinations. */
export const readSectionsFn = (
	mode: "detail" | "form" = "detail",
): ReadonlyArray<SectionDescriptor> => (mode === "form" ? FormSections : DetailSections);
