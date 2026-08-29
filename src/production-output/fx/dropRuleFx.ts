import { Effect } from "effect";

import type { RuleSchema } from "~/production-output/schema/drop/rule/RuleSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { whenFx } from "~/production-condition/fx/whenFx";

export namespace dropRuleFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		rule: RuleSchema.Type;
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
