import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { EditorItemSectionDescriptor } from "~/item-authoring/ui/EditorItemSections";
import { readEditorItemSectionsFn } from "~/item-authoring/ui/fn/readEditorItemSectionsFn";

/** Returns only canonical sections that own editable item fields. */
export const readEditorItemFormSectionsFn = (
	item: Pick<ItemSchema.Type, "type">,
): ReadonlyArray<EditorItemSectionDescriptor> =>
	readEditorItemSectionsFn(item).filter(
		(section) => section.id !== "estimate" && section.id !== "delete",
	);
