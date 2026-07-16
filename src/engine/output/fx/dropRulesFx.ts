import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { RuleSchema } from "~/engine/output/schema/drop/rule/RuleSchema";
import type { RulesResultSchema } from "~/engine/output/schema/drop/rule/RulesResultSchema";
import { dropRuleFx } from "./dropRuleFx";

export namespace dropRulesFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rules: RuleSchema.Type[];
	}
}

/**
 * Evaluates an ordered collection of selected-drop rules without interpreting
 * whether the selected drop should be emitted.
 */
export const dropRulesFx = Effect.fn("dropRulesFx")(function* ({
	origin,
	rules,
}: dropRulesFx.Props) {
	return (yield* Effect.forEach(rules, (rule) => {
		return dropRuleFx({
			origin,
			rule,
		});
	})) satisfies RulesResultSchema.Type;
});
