import type { SectionId } from "~/item-authoring/type/Section";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readSectionForPathFn = (path: ReadonlyArray<PropertyKey>): SectionId => {
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
