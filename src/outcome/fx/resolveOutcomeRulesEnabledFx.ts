import { Effect } from "effect";
import { match } from "ts-pattern";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { outcomeRuleFx } from "~/outcome/fx/outcomeRuleFx";
import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";
import { OutcomeRuleTypeSchema } from "~/outcome/schema/OutcomeRuleTypeSchema";

export namespace resolveOutcomeRulesEnabledFx {
	export interface Props {
		readonly origin: BoardLocationSchema.Type;
		readonly rules: ReadonlyArray<OutcomeRuleSchema.Type>;
	}
}

/** Resolves one ordered availability-rule collection with Disable veto semantics. */
export const resolveOutcomeRulesEnabledFx = Effect.fn("resolveOutcomeRulesEnabledFx")(function* ({
	origin,
	rules,
}: resolveOutcomeRulesEnabledFx.Props) {
	for (const rule of rules) {
		const enabled = yield* outcomeRuleFx({
			origin,
			rule,
		}).pipe(
			Effect.map((result) =>
				match(result)
					.with(
						{
							type: OutcomeRuleTypeSchema.enum.Enable,
						},
						({ active }) => active,
					)
					.with(
						{
							type: OutcomeRuleTypeSchema.enum.Disable,
						},
						({ active }) => !active,
					)
					.exhaustive(),
			),
		);
		if (!enabled) return false;
	}
	return true;
});
