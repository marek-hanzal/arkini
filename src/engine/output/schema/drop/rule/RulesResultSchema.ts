import { z } from "zod";

import { RuleResultSchema } from "./RuleResultSchema";

/**
 * Results of evaluating an ordered collection of selected-drop rules.
 *
 * The result preserves authoring order and intentionally does not interpret
 * whether the selected drop should be emitted.
 */
export const RulesResultSchema = z.array(RuleResultSchema).meta({
	id: "DropRulesResultSchema",
	description:
		"The ordered results of evaluating selected-drop rules without emission-specific interpretation.",
});

export type RulesResultSchema = typeof RulesResultSchema;

export namespace RulesResultSchema {
	export type Type = z.infer<RulesResultSchema>;
}
