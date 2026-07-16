import { Effect } from "effect";

import type { RuleEnableSchema } from "~/engine/line/schema/rule/RuleEnableSchema";
import type { RuleEnableResultSchema } from "~/engine/line/schema/rule/RuleEnableResultSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleEnableFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuleEnableSchema.Type;
	}
}

/**
 * Evaluates one positive availability gate for a product line.
 */
export const lineRuleEnableFx = Effect.fn("lineRuleEnableFx")(function* ({
	origin,
	rule,
}: lineRuleEnableFx.Props) {
	const active = yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});

	return {
		active,
		type: rule.type,
	} satisfies RuleEnableResultSchema.Type;
});
