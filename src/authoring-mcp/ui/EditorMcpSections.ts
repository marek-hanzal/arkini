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
	readonly id: string;
	readonly label: string;
}>;

export type EditorMcpSectionId = (typeof EditorMcpSections)[number]["id"];
