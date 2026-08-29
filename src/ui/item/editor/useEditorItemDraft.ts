import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { useMemo } from "react";
import { createEditorItemDraftFn } from "~/editor/item/fn/createEditorItemDraftFn";
import { useEditorProject } from "~/ui/editor/useEditorProject";
/** Creates one stable local create-form item for a preallocated immutable UID. */
export const useEditorItemDraft = (type: TypeSchema.Type, uid: string): ItemSchema.Type => {
	const project = useEditorProject();
	return useMemo(
		() =>
			createEditorItemDraftFn({
				resourceId: project.resources[0]?.id ?? "missing-asset",
				type,
				uid,
			}),
		[
			project.resources,
			type,
			uid,
		],
	);
};
