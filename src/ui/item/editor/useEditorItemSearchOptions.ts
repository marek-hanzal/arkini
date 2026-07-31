import { useMemo } from "react";

import { createEditorItemSearchTerms } from "~/bridge/item/editor/createEditorItemSearchTerms";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorSearchOption } from "~/ui/form/EditorSearchCombobox";

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
							terms: createEditorItemSearchTerms(item),
						}) satisfies EditorSearchOption,
				),
		[items],
	);
	return {
		items,
		options,
	};
};
