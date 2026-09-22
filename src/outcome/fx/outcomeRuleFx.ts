import { Effect } from "effect";

import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

export namespace outcomeRuleFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: OutcomeRuleSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly type: "enable" | "disable";
	}
}

/**
 * Dispatches one outcome availability rule to its specialized evaluator.
 */
export const outcomeRuleFx = Effect.fn("outcomeRuleFx")(function* ({
	origin,
	rule,
}: outcomeRuleFx.Props) {
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
	} satisfies outcomeRuleFx.Result;
});
