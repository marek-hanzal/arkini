import { Effect } from "effect";
import { match } from "ts-pattern";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { dropRuleFx } from "~/production-output/fx/dropRuleFx";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import { DropRuleTypeSchema } from "~/production-output/schema/DropRuleTypeSchema";

export namespace resolveDropRulesEnabledFx {
	export interface Props {
		readonly origin: BoardLocationSchema.Type;
		readonly rules: ReadonlyArray<DropRuleSchema.Type>;
	}
}

/** Resolves one ordered availability-rule collection with Disable veto semantics. */
export const resolveDropRulesEnabledFx = Effect.fn("resolveDropRulesEnabledFx")(function* ({
	origin,
	rules,
}: resolveDropRulesEnabledFx.Props) {
	for (const rule of rules) {
		const enabled = yield* dropRuleFx({
			origin,
			rule,
		}).pipe(
			Effect.map((result) =>
				match(result)
					.with(
						{
							type: DropRuleTypeSchema.enum.Enable,
						},
						({ active }) => active,
					)
					.with(
						{
							type: DropRuleTypeSchema.enum.Disable,
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
