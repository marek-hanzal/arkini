export const ProjectSectionIds = [
	"general",
	"images",
	"board",
	"introduction",
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
		id: "images",
		label: "Images",
		shortcut: "i",
	},
	{
		id: "board",
		label: "Board",
		shortcut: "b",
	},
	{
		id: "introduction",
		label: "Introduction",
		shortcut: "r",
	},
] as const satisfies ReadonlyArray<ProjectSectionDescriptor>;
