import { Effect } from "effect";

import type { RuleDisableSchema } from "~/v1/line/schema/rule/RuleDisableSchema";
import type { RuleDisableResultSchema } from "~/v1/line/schema/rule/RuleDisableResultSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace lineRuleDisableFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuleDisableSchema.Type;
	}
}

/**
 * Evaluates one conditional availability veto for a product line.
 */
export const lineRuleDisableFx = Effect.fn("lineRuleDisableFx")(function* ({
	origin,
	rule,
}: lineRuleDisableFx.Props) {
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
