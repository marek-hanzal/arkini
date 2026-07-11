import { Effect } from "effect";

import type { RuleEnableSchema } from "~/v1/output/schema/drop/rule/RuleEnableSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace dropRuleEnableFx {
	export interface Props {
		origin: RuntimeItemSchema.Type;
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
	for (const when of rule.when) {
		const passed = yield* whenFx({
			origin,
			when,
		});
		if (!passed) {
			return false;
		}
	}

	return true;
});
