export const EditorAssetDetailSections = [
	{
		id: "overview",
		label: "Overview",
		shortcut: "o",
		to: "/editor/$projectId/assets/$resourceId/detail/overview",
	},
	{
		id: "usage",
		label: "Usage",
		shortcut: "u",
		to: "/editor/$projectId/assets/$resourceId/detail/usage",
	},
	{
		id: "notes",
		label: "Notes",
		shortcut: "n",
		to: "/editor/$projectId/assets/$resourceId/detail/notes",
	},
	{
		id: "delete",
		label: "Delete",
		shortcut: "d",
		to: "/editor/$projectId/assets/$resourceId/detail/delete",
	},
] as const;

export type EditorAssetDetailSection = (typeof EditorAssetDetailSections)[number];
