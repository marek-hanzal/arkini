import { Effect } from "effect";

import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

export namespace dropRuleFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		rule: DropRuleSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly type: "enable" | "disable";
	}
}

/**
 * Dispatches one selected-drop availability rule to its specialized evaluator.
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
