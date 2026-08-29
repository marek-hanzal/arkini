import type { EditorItemSectionId } from "~/item-authoring/ui/EditorItemSections";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readEditorItemSectionForPathFn = (
	path: ReadonlyArray<PropertyKey>,
): EditorItemSectionId => {
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
};
