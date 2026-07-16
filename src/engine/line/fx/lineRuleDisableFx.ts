import { Effect } from "effect";

import type { RuleDisableSchema } from "~/engine/line/schema/rule/RuleDisableSchema";
import type { RuleDisableResultSchema } from "~/engine/line/schema/rule/RuleDisableResultSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

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
