import { z } from "zod";

/** Each kind keeps one authored role; consumers may select several without merging occurrences. */
export const GraphEdgeKindSchema = z.enum([
	"line-material",
	"line-unit-selector",
	"line-unit-cost",
	"line-item-outcome",
	"merge-target",
	"merge-replacement",
	"merge-target-replacement",
	"merge-item-outcome",
	"merge-space",
	"merge-source-spend",
	"merge-target-spend",
	"depletion-item-outcome",
	"rule-reference",
	"space-outcome",
	"template-outcome",
	"template-item",
	"start-template",
	"start-space",
]);
export type GraphEdgeKindSchema = typeof GraphEdgeKindSchema;
export namespace GraphEdgeKindSchema {
	export type Type = z.infer<GraphEdgeKindSchema>;
}
