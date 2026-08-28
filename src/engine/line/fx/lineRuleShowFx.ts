import { Effect } from "effect";

import type { ShowSchema } from "~/engine/line/schema/rule/ShowSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleShowFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: ShowSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly failedWhenIndex?: number;
		readonly type: "show";
	}
}

/**
 * Evaluates one conditional request to show a product line.
 */
export const lineRuleShowFx = Effect.fn("lineRuleShowFx")(function* ({
	origin,
	rule,
}: lineRuleShowFx.Props) {
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
	} satisfies lineRuleShowFx.Result;
});
