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
		if (trigger !== undefined && trigger !== LineTriggerEnumSchema.enum.manual)
			return "automation";
	}
	return match(path[0])
		.returnType<SectionId>()
		.with("artwork", () => "artwork")
		.with("units", () => "identity")
		.with("merge", () => "merges")
		.with("clock", () => "clock")
		.with("terminationMode", () => "identity")
		.with("lines", "maxQueueSize", () => "production")
		.otherwise(() => "identity");
};
