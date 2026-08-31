import { useCallback, useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";

/** Builds one canonical-item Fuse corpus used by every item reference picker. */
export const useEditorItemSearchOptions = () => {
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	const options = useMemo(
		() =>
			Object.values(items)
				.sort((left, right) => left.title.localeCompare(right.title))
				.map(
					(item) =>
						({
							id: item.id,
							label: item.title,
							meta: `${item.type} · ${item.id}`,
							terms: [
								item.id,
								item.title,
								item.description,
								item.type,
							],
						}) satisfies EditorSearchOption,
				),
		[
			items,
		],
	);
	return {
		items,
		options,
	};
};

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
