import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { EnableSchema } from "~/engine/output/schema/drop/rule/EnableSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace dropRuleEnableFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		rule: EnableSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly type: "enable";
	}
}

/**
 * Evaluates one selected-drop enable rule without interpreting its result.
 */
export const dropRuleEnableFx = Effect.fn("dropRuleEnableFx")(function* ({
	origin,
	rule,
}: dropRuleEnableFx.Props) {
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
	} satisfies dropRuleEnableFx.Result;
});
