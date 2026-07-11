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
	const disabled = yield* Effect.every(rule.when, (when) => {
		return whenFx({
			origin,
			when,
		});
	});

	return !disabled;
});
