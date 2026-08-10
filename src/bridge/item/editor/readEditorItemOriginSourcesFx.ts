import { Effect } from "effect";

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { readEditorItemOriginSources } from "~/editor/EditorItemOriginSource";

/** Wraps the shared canonical relationship projector for the cooperative UI flow builder. */
export const readEditorItemOriginSourcesFx = Effect.fn("readEditorItemOriginSourcesFx")(
	(item: EditorItem) => Effect.sync(() => readEditorItemOriginSources(item)),
);
