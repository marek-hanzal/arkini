import { Effect } from "effect";

import type { RuleShowSchema } from "~/engine/line/schema/rule/RuleShowSchema";
import type { RuleShowResultSchema } from "~/engine/line/schema/rule/RuleShowResultSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleShowFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
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
