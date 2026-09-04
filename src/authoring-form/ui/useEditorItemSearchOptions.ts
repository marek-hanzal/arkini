import { useCallback, useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const includeEveryItemFn = (_item: ItemSchema.Type) => true;

/** Builds one canonical-item Fuse corpus used by every item reference picker. */
export const useEditorItemSearchOptions = (
	includeItemFn: (item: ItemSchema.Type) => boolean = includeEveryItemFn,
) => {
	const project = useEditorProject();
	const items = project.config?.items ?? {};
	const options = useMemo(
		() =>
			Object.values(items)
				.filter(includeItemFn)
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
			includeItemFn,
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
