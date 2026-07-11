import { Effect } from "effect";

import type { RuleShowSchema } from "~/v1/line/schema/rule/RuleShowSchema";
import type { RuleShowResultSchema } from "~/v1/line/schema/rule/RuleShowResultSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace lineRuleShowFx {
	export interface Props {
		origin: PositionSchema.Type;
		rule: RuleShowSchema.Type;
	}
}

/**
 * Evaluates one conditional request to show a product line.
 */
export const lineRuleShowFx = Effect.fn("lineRuleShowFx")(function* ({
	origin,
	rule,
}: lineRuleShowFx.Props) {
	const active = yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});

	return {
		active,
		type: rule.type,
	} satisfies RuleShowResultSchema.Type;
});
