import { Effect } from "effect";

import type { RuntimeAdjustmentSchema } from "~/engine/line/schema/rule/RuntimeAdjustmentSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleRuntimeAdjustFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuntimeAdjustmentSchema.Type;
	}

	export interface Result {
		readonly active: boolean;
		readonly failedWhenIndex?: number;
		readonly type: "runtime:adjust";
		readonly adjustMs: number;
	}
}

/** Evaluates one conditional signed product-line runtime adjustment. */
export const lineRuleRuntimeAdjustFx = Effect.fn("lineRuleRuntimeAdjustFx")(function* ({
	origin,
	rule,
}: lineRuleRuntimeAdjustFx.Props) {
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
		adjustMs: rule.adjustMs,
		type: rule.type,
	} satisfies lineRuleRuntimeAdjustFx.Result;
});
