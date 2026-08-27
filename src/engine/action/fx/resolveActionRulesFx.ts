import { Effect } from "effect";

import { resolveActionRuleFx } from "~/engine/action/fx/resolveActionRuleFx";
import type { ActionRuleSchema } from "~/engine/action/schema/ActionRuleSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/** Evaluates ordered immediate-action availability rules without mutating runtime. */
export const resolveActionRulesFx = Effect.fn("resolveActionRulesFx")(function* ({
	origin,
	rules,
}: {
	readonly origin: GridLocationSchema.Type;
	readonly rules: ReadonlyArray<ActionRuleSchema.Type>;
}) {
	return yield* Effect.forEach(rules, (rule) =>
		resolveActionRuleFx({
			origin,
			rule,
		}),
	);
});
