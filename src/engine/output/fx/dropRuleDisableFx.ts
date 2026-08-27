import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuleDisableResultSchema } from "~/engine/output/schema/drop/rule/RuleDisableResultSchema";
import type { RuleDisableSchema } from "~/engine/output/schema/drop/rule/RuleDisableSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace dropRuleDisableFx {
	export interface Props {
		origin: GridLocationSchema.Type;
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
	let active = true;
	for (const when of rule.when) {
		if (
			!(yield* whenFx({
				origin,
				when,
			}))
		) {
			active = false;
			break;
		}
	}

	return {
		active,
		type: rule.type,
	} satisfies RuleDisableResultSchema.Type;
});
