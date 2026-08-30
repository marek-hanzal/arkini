import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useMemo } from "react";
import { createEditorItemDraftFn } from "~/item-authoring/domain/fn/createEditorItemDraftFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
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
