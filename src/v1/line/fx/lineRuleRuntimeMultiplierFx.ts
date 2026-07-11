import { Effect } from "effect";

import type { RuleRuntimeMultiplierSchema } from "~/v1/line/schema/rule/RuleRuntimeMultiplierSchema";
import type { RuleRuntimeMultiplierResultSchema } from "~/v1/line/schema/rule/RuleRuntimeMultiplierResultSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace lineRuleRuntimeMultiplierFx {
	export interface Props {
		origin: PositionSchema.Type;
		rule: RuleRuntimeMultiplierSchema.Type;
	}
}

/**
 * Evaluates one conditional product-line runtime multiplier.
 */
export const lineRuleRuntimeMultiplierFx = Effect.fn("lineRuleRuntimeMultiplierFx")(function* ({
	origin,
	rule,
}: lineRuleRuntimeMultiplierFx.Props) {
	const active = yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});

	return {
		active,
		multiplier: rule.multiplier,
		type: rule.type,
	} satisfies RuleRuntimeMultiplierResultSchema.Type;
});
