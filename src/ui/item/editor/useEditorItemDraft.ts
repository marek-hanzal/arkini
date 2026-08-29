import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { useMemo } from "react";
import { useEditorProject } from "~/ui/editor/useEditorProject";
import { createEditorItemDraftFx } from "~/editor/createEditorItemDraftFx";
import { RendererRuntime } from "~/renderer/RendererRuntime";
/** Creates one stable local create-form item for a preallocated immutable UID. */
export const useEditorItemDraft = (type: TypeSchema.Type, uid: string): ItemSchema.Type => {
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
