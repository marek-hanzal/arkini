import { Effect } from "effect";

import type { RuntimeAdjustmentSchema } from "~/engine/line/schema/rule/RuntimeAdjustmentSchema";
import type { RuleRuntimeAdjustResultSchema } from "~/engine/line/schema/rule/RuleRuntimeAdjustResultSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { whenFx } from "~/engine/when/fx/whenFx";

export namespace lineRuleRuntimeAdjustFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		rule: RuntimeAdjustmentSchema.Type;
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
	} satisfies RuleRuntimeAdjustResultSchema.Type;
});
