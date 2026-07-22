import { Effect } from "effect";
import { match } from "ts-pattern";

import { RuleEnumSchema } from "~/engine/output/schema/drop/rule/RuleEnumSchema";
import type { RuleSchema } from "~/engine/output/schema/drop/rule/RuleSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";

import { dropRuleDisableFx } from "./dropRuleDisableFx";
import { dropRuleEnableFx } from "./dropRuleEnableFx";

export namespace dropRuleFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
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
				type: RuleEnumSchema.enum.Enable,
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
				type: RuleEnumSchema.enum.Disable,
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
