import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionRuleFx } from "~/engine/action/fx/resolveActionRuleFx";
import { TypeSchema } from "~/engine/line/schema/rule/TypeSchema";
import type { RuleSchema } from "~/engine/line/schema/rule/RuleSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";

import { lineRuleHideFx } from "./lineRuleHideFx";
import { lineRuleRuntimeAdjustFx } from "./lineRuleRuntimeAdjustFx";
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
				type: TypeSchema.enum.Show,
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
				type: TypeSchema.enum.Hide,
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
				type: TypeSchema.enum.Enable,
			},
			(rule) => {
				return resolveActionRuleFx({
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
				return resolveActionRuleFx({
					origin,
					rule,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.RuntimeAdjust,
			},
			(rule) => {
				return lineRuleRuntimeAdjustFx({
					origin,
					rule,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.RuntimeMultiplier,
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
