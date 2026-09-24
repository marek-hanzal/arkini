import { match } from "ts-pattern";
import type { SectionId } from "~/item-authoring/type/Section";

/** Maps one canonical item-schema path to its route-owned form section. */
export const readSectionForPathFn = (path: ReadonlyArray<PropertyKey>): SectionId => {
	return match(path[0])
		.returnType<SectionId>()
		.with("artwork", () => "artwork")
		.with("units", () => "units")
		.with("merge", () => "merges")
		.with("clock", () => "clock")
		.with("lines", "maxQueueSize", () => "production")
		.otherwise(() => "identity");
};
