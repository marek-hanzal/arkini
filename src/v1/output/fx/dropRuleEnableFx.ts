import { Effect } from "effect";

import type { RuleEnableSchema } from "~/v1/output/schema/drop/rule/RuleEnableSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace dropRuleEnableFx {
	export interface Props {
		origin: PositionSchema.Type;
		rule: RuleEnableSchema.Type;
	}
}

/**
 * Keeps a selected drop enabled only when every configured condition passes.
 */
export const dropRuleEnableFx = Effect.fn("dropRuleEnableFx")(function* ({
	origin,
	rule,
}: dropRuleEnableFx.Props) {
	return yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});
});
