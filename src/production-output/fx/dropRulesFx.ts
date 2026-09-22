import { Effect } from "effect";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";
import { dropRuleFx } from "./dropRuleFx";

export namespace dropRulesFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rules: readonly DropRuleSchema.Type[];
	}

	export type Result = ReadonlyArray<dropRuleFx.Result>;
}

/**
 * Evaluates an ordered output-rule collection without interpreting whether its
 * candidate or selected drop is available.
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
