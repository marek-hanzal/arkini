import { Effect } from "effect";

import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readEditorItemSectionForPathFx = Effect.fn("readEditorItemSectionForPathFx")(
	(path: ReadonlyArray<PropertyKey>) =>
		Effect.sync((): EditorItemSectionId => {
			switch (path[0]) {
				case "asset":
					return "artwork";
				case "maxCount":
				case "maxStackSize":
					return "identity";
				case "charges":
					return "charges";
				case "merge":
					return "merges";
				case "durationMs":
				case "line":
				case "lines":
				case "maxQueueSize":
				case "output":
					return "production";
				default:
					return "identity";
			}
		}),
);
