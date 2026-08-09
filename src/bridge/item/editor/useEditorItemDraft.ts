import { useMemo } from "react";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { createEditorItemDraftFx } from "~/bridge/item/editor/createEditorItemDraftFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorItem, EditorItemType } from "~/bridge/item/editor/EditorItemModel";

/** Creates one stable local create-form item for a preallocated immutable UID. */
export const useEditorItemDraft = (type: EditorItemType, uid: string): EditorItem => {
	const project = useEditorProject();
	return useMemo(
		() =>
			RendererRuntime.runSync(
				createEditorItemDraftFx({
					resourceId: project.resources[0]?.id ?? "missing-asset",
					type,
					uid,
				}),
			),
		[
			project.resources,
			type,
			uid,
		],
	);
};
