import { Effect } from "effect";
import { match } from "ts-pattern";

import type { RuleSchema } from "~/v1/line/schema/rule/RuleSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
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
				type: "show",
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
				type: "hide",
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
				type: "enable",
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
				type: "disable",
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
				type: "runtime:multiplier",
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
