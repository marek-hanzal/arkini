export const EditorMcpSectionIds = [
	"server",
	"settings",
] as const;

export type EditorMcpSectionId = (typeof EditorMcpSectionIds)[number];

export const EditorMcpSections = [
	{
		id: "server",
		label: "Server",
	},
	{
		id: "settings",
		label: "Settings",
	},
] as const satisfies ReadonlyArray<{
	readonly id: EditorMcpSectionId;
	readonly label: string;
}>;
