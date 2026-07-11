import { Effect } from "effect";

import type { RuleDisableSchema } from "~/v1/output/schema/drop/rule/RuleDisableSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { whenFx } from "~/v1/when/fx/whenFx";

export namespace dropRuleDisableFx {
	export interface Props {
		origin: RuntimeItemSchema.Type;
		rule: RuleDisableSchema.Type;
	}
}

/**
 * Keeps a selected drop enabled unless every configured condition passes.
 */
export const dropRuleDisableFx = Effect.fn("dropRuleDisableFx")(function* ({
	origin,
	rule,
}: dropRuleDisableFx.Props) {
	for (const when of rule.when) {
		const passed = yield* whenFx({
			origin,
			when,
		});
		if (!passed) {
			return true;
		}
	}

	return false;
});
