import { match } from "ts-pattern";
import type { SectionId } from "~/item-authoring/type/Section";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readSectionForPathFn = (
	path: ReadonlyArray<PropertyKey>,
	lines?: ReadonlyArray<LineSchema.Type>,
): SectionId => {
	if (path[0] === "lines" && typeof path[1] === "number") {
		const trigger = lines?.[path[1]]?.trigger;
		if (trigger === LineTriggerEnumSchema.enum["item-termination"]) return "identity";
		if (trigger === LineTriggerEnumSchema.enum["clock-interval"]) return "clock";
	}
	return match(path[0])
		.returnType<SectionId>()
		.with("artwork", () => "artwork")
		.with("units", () => "units")
		.with("merge", () => "merges")
		.with("clock", () => "clock")
		.with("lines", "maxQueueSize", () => "production")
		.otherwise(() => "identity");
};
