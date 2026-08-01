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

export const parseEditorProjectSectionId = (candidate: string): EditorProjectSectionId => {
	const section = EditorProjectSectionIds.find((id) => id === candidate);
	if (section === undefined) throw new Error(`Unknown editor project section ${candidate}.`);
	return section;
};

export const readEditorProjectSectionForPath = (
	path: ReadonlyArray<PropertyKey>,
): EditorProjectSectionId => {
	switch (path[0]) {
		case "hero":
		case "avatars":
			return "appearance";
		case "board":
			return "board";
		case "toolbarSize":
			return "toolbar";
		case "inventory":
			return "inventory";
		default:
			return "general";
	}
};
