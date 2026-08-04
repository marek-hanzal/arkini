import { useMatchRoute } from "@tanstack/react-router";

export const EditorWorkspaceRoutes = [
	{
		id: "project",
		icon: "icon-[lucide--folder-cog]",
		label: "Project",
		matchTo: "/editor/$projectId/project",
		to: "/editor/$projectId/project",
	},
	{
		id: "items",
		icon: "icon-[lucide--boxes]",
		label: "Items",
		matchTo: "/editor/$projectId/editor",
		to: "/editor/$projectId/editor/items/list",
	},
	{
		id: "assets",
		icon: "icon-[lucide--images]",
		label: "Assets",
		matchTo: "/editor/$projectId/assets",
		to: "/editor/$projectId/assets",
	},
	{
		id: "build",
		icon: "icon-[lucide--package-check]",
		label: "Build",
		matchTo: "/editor/$projectId/build",
		to: "/editor/$projectId/build",
	},
	{
		id: "board",
		icon: "icon-[lucide--layout-grid]",
		label: "Board",
		matchTo: "/editor/$projectId/board",
		to: "/editor/$projectId/board",
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
