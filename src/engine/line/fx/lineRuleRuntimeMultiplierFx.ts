import { Effect } from "effect";

import type { RuleRuntimeMultiplierSchema } from "~/engine/line/schema/rule/RuleRuntimeMultiplierSchema";
import type { RuleRuntimeMultiplierResultSchema } from "~/engine/line/schema/rule/RuleRuntimeMultiplierResultSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleRuntimeMultiplierFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
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
