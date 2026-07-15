import { Effect } from "effect";

import type { RuleHideSchema } from "~/v1/line/schema/rule/RuleHideSchema";
import type { RuleHideResultSchema } from "~/v1/line/schema/rule/RuleHideResultSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace lineRuleHideFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuleHideSchema.Type;
	}
}

/**
 * Evaluates one conditional request to hide a product line.
 */
export const lineRuleHideFx = Effect.fn("lineRuleHideFx")(function* ({
	origin,
	rule,
}: lineRuleHideFx.Props) {
	const active = yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});

	return {
		active,
		type: rule.type,
	} satisfies RuleHideResultSchema.Type;
});
