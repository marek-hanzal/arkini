import type { SectionDescriptor } from "~/item-authoring/type/Section";

const FormSections = [
	{
		id: "identity",
		label: "Item",
		shortcut: "i",
	},
	{
		id: "artwork",
		label: "Artwork",
		shortcut: "a",
	},
	{
		id: "production",
		label: "Production",
		shortcut: "p",
	},
	{
		id: "merges",
		label: "Merges",
		shortcut: "m",
	},
	{
		id: "units",
		label: "Units",
		shortcut: "u",
	},
	{
		id: "clock",
		label: "Clock",
		shortcut: "c",
	},
	{
		id: "action",
		label: "Action",
		shortcut: "t",
	},
] as const satisfies ReadonlyArray<SectionDescriptor>;

const DetailSections = [
	...FormSections,
	{
		id: "estimate",
		label: "Estimate",
		shortcut: "s",
	},
	{
		id: "chain",
		label: "Chain",
		shortcut: "h",
	},
	{
		id: "connections",
		label: "Connections",
		shortcut: "o",
	},
	{
		id: "notes",
		label: "Notes",
		shortcut: "n",
	},
	{
		id: "delete",
		label: "Delete",
		shortcut: "d",
	},
] as const satisfies ReadonlyArray<SectionDescriptor>;

/** Detail and authoring share capability order; analysis and project tools extend detail. */
export const readSectionsFn = (
	mode: "detail" | "form" = "detail",
): ReadonlyArray<SectionDescriptor> => (mode === "form" ? FormSections : DetailSections);
