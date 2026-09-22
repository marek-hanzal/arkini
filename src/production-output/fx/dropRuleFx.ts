import { Effect } from "effect";

import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

export namespace dropRuleFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: DropRuleSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly type: "enable" | "disable";
	}
}

/**
 * Dispatches one output availability rule to its specialized evaluator.
 */
export const dropRuleFx = Effect.fn("dropRuleFx")(function* ({ origin, rule }: dropRuleFx.Props) {
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
	} satisfies dropRuleFx.Result;
});
