import { useMemo } from "react";

import type { EditorItem } from "~/bridge/editor/EditorItemModel";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { useEditorProjectDraft } from "~/bridge/editor/useEditorProjectDraft";

/** Overlays staged item changes only for item-authoring surfaces that explicitly opt in. */
export const useVisibleEditorItems = (): Readonly<Record<string, EditorItem>> => {
	const project = useEditorProject();
	const staged = useEditorProjectDraft(project.projectId);
	const canonicalItems = project.config?.items;
	return useMemo(() => {
		const items: Record<string, EditorItem> = {
			...(canonicalItems ?? {}),
		};
		for (const change of Object.values(staged)) {
			if (change.sourceItemId !== undefined && change.sourceItemId !== change.item.id) {
				delete items[change.sourceItemId];
			}
			items[change.item.id] = change.item;
		}
		return items;
	}, [
		canonicalItems,
		staged,
	]);
};
