import { Effect } from "effect";

import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { RuleDisableResultSchema } from "~/v1/output/schema/drop/rule/RuleDisableResultSchema";
import type { RuleDisableSchema } from "~/v1/output/schema/drop/rule/RuleDisableSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace dropRuleDisableFx {
	export interface Props {
		origin: PositionSchema.Type;
		rule: RuleDisableSchema.Type;
	}
}

/**
 * Evaluates one selected-drop disable rule without interpreting its result.
 */
export const dropRuleDisableFx = Effect.fn("dropRuleDisableFx")(function* ({
	origin,
	rule,
}: dropRuleDisableFx.Props) {
	const active = yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});

	return {
		active,
		type: rule.type,
	} satisfies RuleDisableResultSchema.Type;
});
