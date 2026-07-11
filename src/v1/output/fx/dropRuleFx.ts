import { Effect } from "effect";
import { match } from "ts-pattern";

import type { RuleSchema } from "~/v1/output/schema/drop/rule/RuleSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { dropRuleDisableFx } from "./dropRuleDisableFx";
import { dropRuleEnableFx } from "./dropRuleEnableFx";

export namespace dropRuleFx {
	export interface Props {
		origin: PositionSchema.Type;
		rule: RuleSchema.Type;
	}
}

/**
 * Dispatches one selected-drop availability rule to its specialized evaluator.
 */
export const dropRuleFx = Effect.fn("dropRuleFx")(function* ({ origin, rule }: dropRuleFx.Props) {
	return yield* match(rule)
		.with(
			{
				type: "enable",
			},
			(rule) => {
				return dropRuleEnableFx({
					origin,
					rule,
				});
			},
		)
		.with(
			{
				type: "disable",
			},
			(rule) => {
				return dropRuleDisableFx({
					origin,
					rule,
				});
			},
		)
		.exhaustive();
});
