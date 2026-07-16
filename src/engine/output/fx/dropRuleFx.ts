import { Effect } from "effect";
import { match } from "ts-pattern";

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
