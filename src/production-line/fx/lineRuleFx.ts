import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import { TypeSchema } from "~/production-line/schema/rule/TypeSchema";
import type { RuleSchema } from "~/production-line/schema/rule/RuleSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

interface ConditionalRuleResult {
	readonly active: boolean;
	readonly failedWhenIndex?: number;
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
				type: TypeSchema.enum.Show,
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
				type: TypeSchema.enum.Hide,
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
				type: TypeSchema.enum.RuntimeMultiplier,
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
