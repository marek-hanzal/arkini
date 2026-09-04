import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import { RuleTypeSchema } from "~/production-line/schema/RuleTypeSchema";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

interface ConditionalRuleResult {
	readonly active: boolean;
}

export namespace lineRuleFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuleSchema.Type;
	}

	export type Result =
		| resolveActionRuleFx.Result
		| (ConditionalRuleResult & {
				readonly type: "show" | "hide";
		  })
		| (ConditionalRuleResult & {
				readonly adjustMs: number;
				readonly type: "runtime:adjust";
		  })
		| (ConditionalRuleResult & {
				readonly multiplier: number;
				readonly type: "runtime:multiplier";
		  });
}

const evaluateLineRuleWhensFx = Effect.fn("evaluateLineRuleWhensFx")(function* ({
	origin,
	rule,
}: lineRuleFx.Props) {
	for (const when of rule.when) {
		if (
			!(yield* whenFx({
				origin,
				when,
			}))
		) {
			return false;
		}
	}
	return true;
});

/**
 * Dispatches one product-line rule to its specialized evaluator.
 */
export const lineRuleFx = Effect.fn("lineRuleFx")(function* ({ origin, rule }: lineRuleFx.Props) {
	return yield* match(rule)
		.with(
			{
				type: RuleTypeSchema.enum.Show,
			},
			(rule) =>
				Effect.gen(function* () {
					const active = yield* evaluateLineRuleWhensFx({
						origin,
						rule,
					});
					return {
						active,
						type: rule.type,
					} satisfies lineRuleFx.Result;
				}),
		)
		.with(
			{
				type: RuleTypeSchema.enum.Hide,
			},
			(rule) =>
				Effect.gen(function* () {
					const active = yield* evaluateLineRuleWhensFx({
						origin,
						rule,
					});
					return {
						active,
						type: rule.type,
					} satisfies lineRuleFx.Result;
				}),
		)
		.with(
			{
				type: RuleTypeSchema.enum.Enable,
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
				type: RuleTypeSchema.enum.Disable,
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
				type: RuleTypeSchema.enum.RuntimeAdjust,
			},
			(rule) =>
				Effect.gen(function* () {
					const active = yield* evaluateLineRuleWhensFx({
						origin,
						rule,
					});
					return {
						active,
						adjustMs: rule.adjustMs,
						type: rule.type,
					} satisfies lineRuleFx.Result;
				}),
		)
		.with(
			{
				type: RuleTypeSchema.enum.RuntimeMultiplier,
			},
			(rule) =>
				Effect.gen(function* () {
					const active = yield* evaluateLineRuleWhensFx({
						origin,
						rule,
					});
					return {
						active,
						multiplier: rule.multiplier,
						type: rule.type,
					} satisfies lineRuleFx.Result;
				}),
		)
		.exhaustive();
});
