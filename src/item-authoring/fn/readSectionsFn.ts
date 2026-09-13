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
		id: "production",
		label: "Production",
	},
	{
		id: "merges",
		label: "Merges",
	},
	{
		id: "units",
		label: "Units",
	},
	{
		id: "clock",
		label: "Clock",
	},
	{
		id: "action",
		label: "Action",
	},
] as const satisfies ReadonlyArray<SectionDescriptor>;

const DetailSections = [
	{
		id: "identity",
		label: "Item",
	},
	{
		id: "production",
		label: "Production",
	},
	{
		id: "merges",
		label: "Merges",
	},
	{
		id: "estimate",
		label: "Estimate",
	},
	{
		id: "chain",
		label: "Chain",
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

/** Detail groups related capabilities; authoring retains exact validation destinations. */
export const readSectionsFn = (
	mode: "detail" | "form" = "detail",
): ReadonlyArray<SectionDescriptor> => (mode === "form" ? FormSections : DetailSections);
