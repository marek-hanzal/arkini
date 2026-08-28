import { Effect } from "effect";

import type { RuntimeMultiplierSchema } from "~/engine/line/schema/rule/RuntimeMultiplierSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleRuntimeMultiplierFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuntimeMultiplierSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly failedWhenIndex?: number;
		readonly type: "runtime:multiplier";
		readonly multiplier: number;
	}
}

/**
 * Evaluates one conditional product-line runtime multiplier.
 */
export const lineRuleRuntimeMultiplierFx = Effect.fn("lineRuleRuntimeMultiplierFx")(function* ({
	origin,
	rule,
}: lineRuleRuntimeMultiplierFx.Props) {
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
		multiplier: rule.multiplier,
		type: rule.type,
	} satisfies lineRuleRuntimeMultiplierFx.Result;
});
