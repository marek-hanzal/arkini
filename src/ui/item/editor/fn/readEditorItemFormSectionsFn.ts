import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { EditorItemSectionDescriptor } from "~/ui/item/editor/EditorItemSections";
import { readEditorItemSectionsFn } from "~/ui/item/editor/fn/readEditorItemSectionsFn";

/** Returns only canonical sections that own editable item fields. */
export const readEditorItemFormSectionsFn = (
	item: Pick<ItemSchema.Type, "type">,
): ReadonlyArray<EditorItemSectionDescriptor> =>
	readEditorItemSectionsFn(item).filter(
		(section) => section.id !== "estimate" && section.id !== "delete",
	);
