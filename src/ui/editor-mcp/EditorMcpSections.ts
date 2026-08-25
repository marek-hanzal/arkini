export const EditorMcpSectionIds = [
	"mcp",
	"tunnel",
	"server",
] as const;

export type EditorMcpSectionId = (typeof EditorMcpSectionIds)[number];

export const EditorMcpSections = [
	{
		id: "mcp",
		label: "MCP",
	},
	{
		id: "tunnel",
		label: "Tunnel",
	},
	{
		id: "server",
		label: "Server",
	},
] as const satisfies ReadonlyArray<{
	readonly id: EditorMcpSectionId;
	readonly label: string;
}>;
