import { Effect } from "effect";

import type { RuleSchema } from "~/v1/line/schema/rule/RuleSchema";
import type { RulesResultSchema } from "~/v1/line/schema/rule/RulesResultSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import { lineRuleFx } from "./lineRuleFx";

export namespace lineRulesFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rules: RuleSchema.Type[];
	}
}

/**
 * Evaluates an ordered collection of product-line rules without interpreting
 * their results into any consumer-specific line state.
 */
export const lineRulesFx = Effect.fn("lineRulesFx")(function* ({
	origin,
	rules,
}: lineRulesFx.Props) {
	return (yield* Effect.forEach(rules, (rule) => {
		return lineRuleFx({
			origin,
			rule,
		});
	})) satisfies RulesResultSchema.Type;
});
