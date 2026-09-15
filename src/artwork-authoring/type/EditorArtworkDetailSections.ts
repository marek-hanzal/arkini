export const EditorArtworkDetailSections = [
	{
		id: "overview",
		label: "Overview",
		shortcut: "o",
		to: "/editor/$projectId/artwork/$resourceId/detail/overview",
	},
	{
		id: "usage",
		label: "Usage",
		shortcut: "u",
		to: "/editor/$projectId/artwork/$resourceId/detail/usage",
	},
	{
		id: "notes",
		label: "Notes",
		shortcut: "n",
		to: "/editor/$projectId/artwork/$resourceId/detail/notes",
	},
	{
		id: "delete",
		label: "Delete",
		shortcut: "d",
		to: "/editor/$projectId/artwork/$resourceId/detail/delete",
	},
] as const;

export type EditorArtworkDetailSection = (typeof EditorArtworkDetailSections)[number];
