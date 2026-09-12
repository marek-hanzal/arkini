import type { DetailSectionId, SectionId } from "~/item-authoring/type/Section";

/** Returns the owning overview after saving or discarding one capability form. */
export const readDetailSectionFn = (section: SectionId): DetailSectionId => {
	switch (section) {
		case "artwork":
		case "units":
			return "identity";
		case "action":
		case "merges":
			return "interactions";
		case "clock":
			return "production";
		default:
			return section;
	}
};
