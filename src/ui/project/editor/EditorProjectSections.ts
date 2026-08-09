export const EditorProjectSectionIds = [
	"general",
	"appearance",
	"surfaces",
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
		id: "surfaces",
		label: "Surfaces",
	},
] as const satisfies ReadonlyArray<EditorProjectSectionDescriptor>;
