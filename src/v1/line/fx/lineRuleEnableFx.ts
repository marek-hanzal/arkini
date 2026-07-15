import { Effect } from "effect";

import type { RuleEnableSchema } from "~/v1/line/schema/rule/RuleEnableSchema";
import type { RuleEnableResultSchema } from "~/v1/line/schema/rule/RuleEnableResultSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

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
