import { Effect } from "effect";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";
import { outcomeRuleFx } from "./outcomeRuleFx";

export namespace outcomeRulesFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rules: readonly OutcomeRuleSchema.Type[];
	}

	export type Result = ReadonlyArray<outcomeRuleFx.Result>;
}

/**
 * Evaluates an ordered outcome-rule collection without interpreting whether its
 * candidate or selected outcome is available.
 */
export const outcomeRulesFx = Effect.fn("outcomeRulesFx")(function* ({
	origin,
	rules,
}: outcomeRulesFx.Props) {
	return (yield* Effect.forEach(rules, (rule) => {
		return outcomeRuleFx({
			origin,
			rule,
		});
	})) satisfies outcomeRulesFx.Result;
});
