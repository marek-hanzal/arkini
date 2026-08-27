import { useMatchRoute } from "@tanstack/react-router";

export const EditorWorkspaceRoutes = [
	{
		id: "project",
		icon: "icon-[lucide--folder-cog]",
		label: "Project",
		matchTo: "/editor/$projectId/project",
		shortcut: "Mod+Shift+P",
		to: "/editor/$projectId/project",
	},
	{
		id: "notes",
		icon: "icon-[lucide--notebook-pen]",
		hiddenFromNavigation: true,
		label: "Notes",
		matchTo: "/editor/$projectId/notes",
		shortcut: "Mod+Shift+N",
		to: "/editor/$projectId/notes",
	},
	{
		id: "items",
		icon: "icon-[lucide--boxes]",
		label: "Items",
		matchTo: "/editor/$projectId/editor",
		shortcut: "Mod+Shift+I",
		to: "/editor/$projectId/editor/items/list",
	},
	{
		id: "assets",
		icon: "icon-[lucide--images]",
		label: "Assets",
		matchTo: "/editor/$projectId/assets",
		separatorAfter: true,
		shortcut: "Mod+Shift+A",
		to: "/editor/$projectId/assets",
	},
	{
		id: "estimate",
		icon: "icon-[lucide--calculator]",
		label: "Estimate",
		matchTo: "/editor/$projectId/estimate",
		shortcut: "Mod+Shift+E",
		to: "/editor/$projectId/estimate",
	},
	{
		id: "flow",
		icon: "icon-[lucide--git-fork]",
		label: "Flow",
		matchTo: "/editor/$projectId/flow",
		separatorAfter: true,
		shortcut: "Mod+Shift+F",
		to: "/editor/$projectId/flow",
	},
	{
		id: "mcp",
		icon: "icon-[lucide--radio-tower]",
		label: "MCP",
		matchTo: "/editor/$projectId/mcp",
		shortcut: "Mod+Shift+M",
		to: "/editor/$projectId/mcp",
	},
	{
		id: "chatgpt",
		icon: "icon-[lucide--message-circle-more]",
		label: "ChatGPT",
		matchTo: "/editor/$projectId/chatgpt",
		separatorAfter: true,
		shortcut: "Mod+Shift+C",
		to: "/editor/$projectId/chatgpt",
	},
	{
		id: "versions",
		icon: "icon-[lucide--git-branch]",
		label: "Versions",
		matchTo: "/editor/$projectId/versions",
		separatorAfter: true,
		shortcut: "Mod+Shift+V",
		to: "/editor/$projectId/versions/commit",
	},
	{
		id: "board",
		icon: "icon-[lucide--layout-grid]",
		label: "Board",
		matchTo: "/editor/$projectId/board",
		separatorAfter: true,
		shortcut: "Mod+Shift+B",
		to: "/editor/$projectId/board",
	},
	{
		id: "build",
		icon: "icon-[lucide--package-check]",
		label: "Build",
		matchTo: "/editor/$projectId/build",
		shortcut: "Mod+Shift+U",
		to: "/editor/$projectId/build",
	},
] as const;

export type EditorWorkspaceId = (typeof EditorWorkspaceRoutes)[number]["id"];

/** Projects accepted pending navigation over the currently committed editor workspace. */
export const useEditorActiveWorkspace = (projectId: string): EditorWorkspaceId | undefined => {
	const matchRoute = useMatchRoute();
	const readWorkspace = (pending: boolean) =>
		EditorWorkspaceRoutes.find(
			({ matchTo }) =>
				matchRoute({
					fuzzy: true,
					includeSearch: false,
					params: {
						projectId,
					},
					pending,
					to: matchTo,
				}) !== false,
		)?.id;

	return readWorkspace(true) ?? readWorkspace(false);
};
