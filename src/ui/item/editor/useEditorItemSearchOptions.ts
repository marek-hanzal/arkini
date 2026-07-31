import { useMemo } from "react";

import { createEditorItemSearchTerms } from "~/bridge/editor/createEditorItemSearchTerms";
import type { EditorSearchOption } from "~/ui/form/EditorSearchCombobox";
import { useVisibleEditorItems } from "~/ui/item/editor/useVisibleEditorItems";

/** Builds one visible-item Fuse corpus used by every editor item reference picker. */
export const useEditorItemSearchOptions = () => {
	const items = useVisibleEditorItems();
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
							terms: createEditorItemSearchTerms(item),
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
