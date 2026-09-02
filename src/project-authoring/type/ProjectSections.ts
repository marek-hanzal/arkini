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
}

export const ProjectSections = [
	{
		id: "general",
		label: "General",
	},
	{
		id: "artwork",
		label: "Artwork",
	},
	{
		id: "board",
		label: "Board",
	},
	{
		id: "toolbar",
		label: "Toolbar",
	},
	{
		id: "inventory",
		label: "Inventory",
	},
] as const satisfies ReadonlyArray<ProjectSectionDescriptor>;
