import { Effect } from "effect";

import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import { dropRuleFx } from "./dropRuleFx";

export namespace dropRulesFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		rules: DropRuleSchema.Type[];
	}

	export type Result = ReadonlyArray<dropRuleFx.Result>;
}

/**
 * Evaluates an ordered collection of selected-drop rules without interpreting
 * whether the selected drop should be emitted.
 */
export const dropRulesFx = Effect.fn("dropRulesFx")(function* ({
	origin,
	rules,
}: dropRulesFx.Props) {
	return (yield* Effect.forEach(rules, (rule) => {
		return dropRuleFx({
			origin,
			rule,
		});
	})) satisfies dropRulesFx.Result;
});
