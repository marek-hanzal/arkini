import { Effect } from "effect";
import { match } from "ts-pattern";

import { RuleEnumSchema } from "~/engine/line/schema/rule/RuleEnumSchema";
import type { RuleSchema } from "~/engine/line/schema/rule/RuleSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";

import { lineRuleDisableFx } from "./lineRuleDisableFx";
import { lineRuleEnableFx } from "./lineRuleEnableFx";
import { lineRuleHideFx } from "./lineRuleHideFx";
import { lineRuleRuntimeMultiplierFx } from "./lineRuleRuntimeMultiplierFx";
import { lineRuleShowFx } from "./lineRuleShowFx";

export namespace lineRuleFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuleSchema.Type;
	}
}

/**
 * Dispatches one product-line rule to its specialized evaluator.
 */
export const lineRuleFx = Effect.fn("lineRuleFx")(function* ({ origin, rule }: lineRuleFx.Props) {
	return yield* match(rule)
		.with(
			{
				type: RuleEnumSchema.enum.Show,
			},
			(rule) => {
				return lineRuleShowFx({
					origin,
					rule,
				});
			},
		)
		.with(
			{
				type: RuleEnumSchema.enum.Hide,
			},
			(rule) => {
				return lineRuleHideFx({
					origin,
					rule,
				});
			},
		)
		.with(
			{
				type: RuleEnumSchema.enum.Enable,
			},
			(rule) => {
				return lineRuleEnableFx({
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
				return lineRuleDisableFx({
					origin,
					rule,
				});
			},
		)
		.with(
			{
				type: RuleEnumSchema.enum.RuntimeMultiplier,
			},
			(rule) => {
				return lineRuleRuntimeMultiplierFx({
					origin,
					rule,
				});
			},
		)
		.exhaustive();
});
