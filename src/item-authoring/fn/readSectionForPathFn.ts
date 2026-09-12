import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { SectionId } from "~/item-authoring/type/Section";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readSectionForPathFn = (
	path: ReadonlyArray<PropertyKey>,
	itemType?: TypeSchema.Type,
): SectionId => {
	switch (path[0]) {
		case "action":
			return "action";
		case "enable":
		case "rules":
			return itemType === "clock" ? "production" : "identity";
		case "asset":
			return "artwork";
		case "maxCount":
		case "maxStackSize":
			return "identity";
		case "units":
			return "units";
		case "merge":
			return "merges";
		case "intervalMs":
		case "onExpire":
		case "control":
		case "durationMs":
		case "lines":
		case "maxQueueSize":
		case "output":
			return "production";
		default:
			return "identity";
	}
};
