export const ProjectSectionIds = [
	"general",
	"artwork",
	"board",
	"toolbar",
	"inventory",
] as const;

export type ProjectSectionId = (typeof ProjectSectionIds)[number];

export interface ProjectSectionDescriptor {
	readonly id: ProjectSectionId;
	readonly label: string;
	readonly shortcut: string;
}

export const ProjectSections = [
	{
		id: "general",
		label: "General",
		shortcut: "g",
	},
	{
		id: "artwork",
		label: "Artwork",
		shortcut: "a",
	},
	{
		id: "board",
		label: "Board",
		shortcut: "b",
	},
	{
		id: "toolbar",
		label: "Toolbar",
		shortcut: "t",
	},
	{
		id: "inventory",
		label: "Inventory",
		shortcut: "i",
	},
] as const satisfies ReadonlyArray<ProjectSectionDescriptor>;
