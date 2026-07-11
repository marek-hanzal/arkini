import { z } from "zod";

import { RuleResultSchema } from "./RuleResultSchema";

/**
 * Results of evaluating an ordered collection of product-line rules.
 *
 * The result preserves authoring order and intentionally does not interpret
 * the rules into any consumer-specific line state.
 */
export const RulesResultSchema = z.array(RuleResultSchema).meta({
	id: "LineRulesResultSchema",
	description:
		"The ordered results of evaluating product-line rules without consumer-specific interpretation.",
});

export type RulesResultSchema = typeof RulesResultSchema;

export namespace RulesResultSchema {
	export type Type = z.infer<RulesResultSchema>;
}
