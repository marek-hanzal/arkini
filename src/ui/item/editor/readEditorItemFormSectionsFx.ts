import { Effect } from "effect";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import type { EditorItemSectionDescriptor } from "~/ui/item/editor/EditorItemSections";
import { readEditorItemSectionsFx } from "~/ui/item/editor/readEditorItemSectionsFx";

/** Returns only canonical sections that own editable item fields. */
export const readEditorItemFormSectionsFx = Effect.fn("readEditorItemFormSectionsFx")(
	(item: Pick<EditorItem, "type">) =>
		Effect.map(
			readEditorItemSectionsFx(item),
			(sections): ReadonlyArray<EditorItemSectionDescriptor> =>
				sections.filter((section) => section.id !== "estimate"),
		),
);
