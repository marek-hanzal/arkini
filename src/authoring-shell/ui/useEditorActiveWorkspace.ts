import { useMatchRoute } from "@tanstack/react-router";
import {
	Boxes,
	Calculator,
	FolderCog,
	GitFork,
	Images,
	LayoutGrid,
	NotebookPen,
	Paintbrush,
	PackageCheck,
	RadioTower,
} from "lucide-react";

export const EditorWorkspaceRoutes = [
	{
		id: "project",
		icon: FolderCog,
		label: "Project",
		matchTo: "/editor/$projectId/project",
		shortcut: "Mod+Shift+P",
		to: "/editor/$projectId/project",
	},
	{
		id: "items",
		icon: Boxes,
		label: "Items",
		matchTo: "/editor/$projectId/editor",
		shortcut: "Mod+Shift+I",
		to: "/editor/$projectId/editor/items/list",
	},
	{
		id: "assets",
		icon: Images,
		label: "Assets",
		matchTo: "/editor/$projectId/assets",
		shortcut: "Mod+Shift+A",
		to: "/editor/$projectId/assets",
	},
	{
		id: "painter",
		icon: Paintbrush,
		label: "Tile painter",
		matchTo: "/editor/$projectId/painter",
		shortcut: "Mod+Shift+T",
		to: "/editor/$projectId/painter",
	},
	{
		id: "notes",
		icon: NotebookPen,
		label: "Notes",
		matchTo: "/editor/$projectId/notes",
		separatorAfter: true,
		shortcut: "Mod+Shift+N",
		to: "/editor/$projectId/notes",
	},
	{
		id: "estimate",
		icon: Calculator,
		label: "Estimate",
		matchTo: "/editor/$projectId/estimate",
		shortcut: "Mod+Shift+E",
		to: "/editor/$projectId/estimate",
	},
	{
		id: "flow",
		icon: GitFork,
		label: "Flow",
		matchTo: "/editor/$projectId/flow",
		separatorAfter: true,
		shortcut: "Mod+Shift+F",
		to: "/editor/$projectId/flow",
	},
	{
		id: "mcp",
		icon: RadioTower,
		label: "MCP",
		matchTo: "/editor/$projectId/mcp",
		separatorAfter: true,
		shortcut: "Mod+Shift+M",
		to: "/editor/$projectId/mcp",
	},
	{
		id: "board",
		icon: LayoutGrid,
		label: "Board",
		matchTo: "/editor/$projectId/board",
		separatorAfter: true,
		shortcut: "Mod+Shift+B",
		to: "/editor/$projectId/board",
	},
	{
		id: "build",
		icon: PackageCheck,
		label: "Build",
		matchTo: "/editor/$projectId/build",
		shortcut: "Mod+Shift+U",
		to: "/editor/$projectId/build",
	},
] as const;

export type EditorWorkspaceId = (typeof EditorWorkspaceRoutes)[number]["id"];

/** Projects accepted pending navigation over the currently committed editor workspace. */
export const useEditorActiveWorkspace = (projectId: string): EditorWorkspaceId | undefined => {
	const matchRouteFn = useMatchRoute();
	const readWorkspaceFn = (pending: boolean) =>
		EditorWorkspaceRoutes.find(
			({ matchTo }) =>
				matchRouteFn({
					fuzzy: true,
					includeSearch: false,
					params: {
						projectId,
					},
					pending,
					to: matchTo,
				}) !== false,
		)?.id;

	return readWorkspaceFn(true) ?? readWorkspaceFn(false);
};
