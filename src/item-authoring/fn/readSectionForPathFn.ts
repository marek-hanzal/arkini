import type { SectionId } from "~/item-authoring/type/Section";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readSectionForPathFn = (path: ReadonlyArray<PropertyKey>): SectionId => {
	switch (path[0]) {
		case "action":
			return "action";
		case "asset":
			return "artwork";
		case "maxCount":
		case "maxStackSize":
			return "identity";
		case "units":
			return "units";
		case "merge":
			return "merges";
		case "clock":
			return "clock";
		case "control":
			return "identity";
		case "lines":
		case "maxQueueSize":
			return "production";
		default:
			return "identity";
	}
};
