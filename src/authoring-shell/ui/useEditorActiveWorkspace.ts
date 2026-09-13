import { useMatchRoute } from "@tanstack/react-router";
import {
	Boxes,
	FolderCog,
	GitFork,
	GitBranch,
	Images,
	LayoutGrid,
	NotebookPen,
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
		id: "board",
		icon: LayoutGrid,
		label: "Board",
		matchTo: "/editor/$projectId/board",
		shortcut: "Mod+Shift+B",
		to: "/editor/$projectId/board",
	},
	{
		id: "flow",
		icon: GitFork,
		label: "Flow",
		matchTo: "/editor/$projectId/flow",
		shortcut: "Mod+Shift+F",
		to: "/editor/$projectId/flow",
	},
	{
		id: "chains",
		icon: GitBranch,
		label: "Chains · Experimental",
		matchTo: "/editor/$projectId/chains",
		shortcut: "Mod+Shift+C",
		to: "/editor/$projectId/chains",
	},
	{
		id: "mcp",
		icon: RadioTower,
		label: "MCP",
		matchTo: "/editor/$projectId/mcp",
		shortcut: "Mod+Shift+M",
		to: "/editor/$projectId/mcp",
	},
	{
		id: "notes",
		icon: NotebookPen,
		label: "Notes",
		matchTo: "/editor/$projectId/notes",
		shortcut: "Mod+Shift+N",
		to: "/editor/$projectId/notes",
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
