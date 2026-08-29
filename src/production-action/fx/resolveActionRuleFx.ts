import { Effect } from "effect";
import { match } from "ts-pattern";

import { RuleTypeSchema } from "~/production-action/schema/RuleTypeSchema";
import type { RuleSchema } from "~/production-action/schema/RuleSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

export namespace resolveActionRuleFx {
	interface BaseResult {
		readonly active: boolean;
		readonly failedWhenIndex?: number;
	}

	export interface EnableResult extends BaseResult {
		readonly type: "enable";
	}

	export interface DisableResult extends BaseResult {
		readonly type: "disable";
	}

	export type Result = EnableResult | DisableResult;
}

/** Evaluates one immediate-action availability rule from a real visible origin. */
export const resolveActionRuleFx = Effect.fn("resolveActionRuleFx")(function* ({
	origin,
	rule,
}: {
	readonly origin: GridLocationSchema.Type;
	readonly rule: RuleSchema.Type;
}) {
	return yield* match(rule)
		.with(
			{
				type: RuleTypeSchema.enum.Enable,
			},
			(rule) =>
				Effect.gen(function* () {
					let failedWhenIndex: number | undefined;
					for (const [whenIndex, when] of rule.when.entries()) {
						if (
							!(yield* whenFx({
								origin,
								when,
							}))
						) {
							failedWhenIndex = whenIndex;
							break;
						}
					}
					return {
						active: failedWhenIndex === undefined,
						type: rule.type,
						...(failedWhenIndex === undefined
							? {}
							: {
									failedWhenIndex,
								}),
					} satisfies resolveActionRuleFx.EnableResult;
				}),
		)
		.with(
			{
				type: RuleTypeSchema.enum.Disable,
			},
			(rule) =>
				Effect.gen(function* () {
					let active = true;
					for (const when of rule.when) {
						if (
							!(yield* whenFx({
								origin,
								when,
							}))
						) {
							active = false;
							break;
						}
					}
					return {
						active,
						type: rule.type,
					} satisfies resolveActionRuleFx.DisableResult;
				}),
		)
		.exhaustive();
});
