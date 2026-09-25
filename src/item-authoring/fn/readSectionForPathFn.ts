import { match } from "ts-pattern";
import type { SectionId } from "~/item-authoring/type/Section";
import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readSectionForPathFn = (
	path: ReadonlyArray<PropertyKey>,
	lines?: ReadonlyArray<LineSchema.Type>,
): SectionId => {
	if (path[0] === "lines" && typeof path[1] === "number" && lines?.[path[1]]?.clock !== undefined)
		return "clock";
	return match(path[0])
		.returnType<SectionId>()
		.with("artwork", () => "artwork")
		.with("units", () => "units")
		.with("merge", () => "merges")
		.with("clock", () => "clock")
		.with("lines", "maxQueueSize", () => "production")
		.otherwise(() => "identity");
};
