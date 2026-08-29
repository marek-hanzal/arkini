import { Effect } from "effect";

import type { HideSchema } from "~/engine/line/schema/rule/HideSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleHideFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: HideSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly failedWhenIndex?: number;
		readonly type: "hide";
	}
}

/**
 * Evaluates one conditional request to hide a product line.
 */
export const lineRuleHideFx = Effect.fn("lineRuleHideFx")(function* ({
	origin,
	rule,
}: lineRuleHideFx.Props) {
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
	} satisfies lineRuleHideFx.Result;
});
