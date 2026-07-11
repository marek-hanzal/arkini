import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { RuleSchema } from "~/v1/output/schema/drop/rule/RuleSchema";
import type { RulesResultSchema } from "~/v1/output/schema/drop/rule/RulesResultSchema";
import { dropRuleFx } from "./dropRuleFx";

export namespace dropRulesFx {
	export interface Props {
		origin: PositionSchema.Type;
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
