import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { RuleEnableResultSchema } from "~/engine/output/schema/drop/rule/RuleEnableResultSchema";
import type { RuleEnableSchema } from "~/engine/output/schema/drop/rule/RuleEnableSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace dropRuleEnableFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuleEnableSchema.Type;
	}
}

/**
 * Evaluates one selected-drop enable rule without interpreting its result.
 */
export const dropRuleEnableFx = Effect.fn("dropRuleEnableFx")(function* ({
	origin,
	rule,
}: dropRuleEnableFx.Props) {
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
