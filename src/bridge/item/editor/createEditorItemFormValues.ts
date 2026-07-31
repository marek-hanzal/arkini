import type { EditorItemFormValues } from "~/bridge/item/editor/EditorItemFormSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

/** Projects one canonical item into the local presentation values owned by its form. */
export const createEditorItemFormValues = (
	item: ItemSchema.Type,
): EditorItemFormValues => ({
	...item,
	tags: item.tags.join(", "),
	merge:
		item.merge === undefined
			? undefined
			: [
					...item.merge,
				],
});
