import { Effect } from "effect";
import { match } from "ts-pattern";

import { ActionRuleEnumSchema } from "~/engine/action/schema/ActionRuleEnumSchema";
import type {
	ActionRuleDisableResultSchema,
	ActionRuleEnableResultSchema,
} from "~/engine/action/schema/ActionRuleResultSchema";
import type { ActionRuleSchema } from "~/engine/action/schema/ActionRuleSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

/** Evaluates one immediate-action availability rule from a real visible origin. */
export const resolveActionRuleFx = Effect.fn("resolveActionRuleFx")(function* ({
	origin,
	rule,
}: {
	readonly origin: GridLocationSchema.Type;
	readonly rule: ActionRuleSchema.Type;
}) {
	return yield* match(rule)
		.with(
			{
				type: ActionRuleEnumSchema.enum.Enable,
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
					} satisfies ActionRuleEnableResultSchema.Type;
				}),
		)
		.with(
			{
				type: ActionRuleEnumSchema.enum.Disable,
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
					} satisfies ActionRuleDisableResultSchema.Type;
				}),
		)
		.exhaustive();
});
