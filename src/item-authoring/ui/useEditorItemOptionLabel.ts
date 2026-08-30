import { useCallback } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Resolves one canonical item reference into compact select-option copy. */
export const useEditorItemOptionLabel = () => {
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	return useCallback(
		(itemId: string, fallback: string) => {
			if (itemId.length === 0) return fallback;
			const title = items[itemId]?.title;
			return title === undefined || title.length === 0 ? itemId : `${itemId} — ${title}`;
		},
		[
			items,
		],
	);
};
