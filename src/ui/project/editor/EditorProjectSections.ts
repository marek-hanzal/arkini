export const EditorProjectSectionIds = [
	"general",
	"appearance",
	"board",
	"toolbar",
	"inventory",
] as const;

export type EditorProjectSectionId = (typeof EditorProjectSectionIds)[number];

export interface EditorProjectSectionDescriptor {
	readonly id: EditorProjectSectionId;
	readonly label: string;
}

export const EditorProjectSections = [
	{
		id: "general",
		label: "General",
	},
	{
		id: "appearance",
		label: "Appearance",
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
] as const satisfies ReadonlyArray<EditorProjectSectionDescriptor>;
