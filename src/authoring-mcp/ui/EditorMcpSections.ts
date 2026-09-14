export const EditorMcpSections = [
	{
		id: "server",
		label: "Server",
	},
	{
		id: "local",
		label: "Local",
	},
	{
		id: "ngrok",
		label: "Ngrok",
	},
] as const satisfies ReadonlyArray<{
	readonly id: string;
	readonly label: string;
}>;

export type EditorMcpSectionId = (typeof EditorMcpSections)[number]["id"];
