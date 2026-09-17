export const EditorMcpSections = [
	{
		id: "server",
		label: "Server",
		shortcut: "s",
	},
	{
		id: "local",
		label: "Local",
		shortcut: "l",
	},
	{
		id: "ngrok",
		label: "Ngrok",
		shortcut: "n",
	},
] as const satisfies ReadonlyArray<{
	readonly id: string;
	readonly label: string;
	readonly shortcut: string;
}>;

export type EditorMcpSectionId = (typeof EditorMcpSections)[number]["id"];
