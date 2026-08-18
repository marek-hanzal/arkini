import { Effect } from "effect";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { readAuthoredItemLinesFx } from "~/engine/line/read/readAuthoredItemLinesFx";

/** Exposes canonical authored lines to bridge and editor presentation consumers. */
export const readEditorItemLinesFx = Effect.fn("readEditorItemLinesFx")(function* (
	item: EditorItem,
) {
	return yield* readAuthoredItemLinesFx(item);
});
