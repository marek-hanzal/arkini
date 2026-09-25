import { match } from "ts-pattern";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";

/** UI presets select typed roles; rule mentions never become consumed inputs. */
export const readItemConnectionQueryFn = (
	itemUid: string,
	filter: ItemConnectionFilterSchema.Type,
	to?: string,
): GraphQuerySchema.Type => ({
	kind: "connections",
	from: `item:${itemUid}`,
	to,
	direction: match(filter)
		.returnType<GraphQuerySchema.Type["direction"]>()
		.with("all", () => "both")
		.with("accepts-merge", "inputs", "produced-by", "referenced-by", () => "in")
		.with("merges-into", "required-by", "produces", "references", () => "out")
		.exhaustive(),
	kinds: match(filter)
		.returnType<GraphQuerySchema.Type["kinds"]>()
		.with("all", () => undefined)
		.with("merges-into", "accepts-merge", () => [
			"merge-target",
		])
		.with("references", "referenced-by", () => [
			"rule-reference",
		])
		.with("inputs", "required-by", () => [
			"line-material",
			"line-unit-selector",
			"line-unit-cost",
		])
		.with("produces", "produced-by", () => [
			"line-item-outcome",
			"merge-replacement",
			"merge-item-outcome",
			"depletion-item-outcome",
			"space-outcome",
			"template-outcome",
		])
		.exhaustive(),
	maxDepth: 1,
	detail: "full",
	limit: 100,
	maxExpansions: 10000,
	timeoutMs: 1000,
});
