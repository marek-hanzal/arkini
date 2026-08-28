import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/engine/output/schema/drop/rule/TypeSchema";
import type { RuleSchema } from "~/engine/output/schema/drop/rule/RuleSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

import { dropRuleDisableFx } from "./dropRuleDisableFx";
import { dropRuleEnableFx } from "./dropRuleEnableFx";

export namespace dropRuleFx {
	export interface Props {
		origin: GridLocationSchema.Type;
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
				type: TypeSchema.enum.Enable,
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
				type: TypeSchema.enum.Disable,
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
