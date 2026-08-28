import { Effect } from "effect";

import type { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { TypeSchema } from "~/engine/line/schema/rule/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";

export namespace resolveLineRuntimeFx {
	export interface Props {
		line: Pick<LineSchema.Type, "runtimeMs">;
		rules: lineRulesFx.Result;
	}
}

/**
 * Applies active multipliers and then signed millisecond adjustments.
 */
export const resolveLineRuntimeFx = Effect.fn("resolveLineRuntimeFx")(function* ({
	line,
	rules,
}: resolveLineRuntimeFx.Props) {
	const multiplier = rules.reduce((value, rule) => {
		return rule.type === TypeSchema.enum.RuntimeMultiplier && rule.active
			? value * rule.multiplier
			: value;
	}, 1);
	const adjustmentMs = rules.reduce((value, rule) => {
		return rule.type === TypeSchema.enum.RuntimeAdjust && rule.active
			? value + rule.adjustMs
			: value;
	}, 0);

	return Math.max(
		0,
		Math.ceil(line.runtimeMs * multiplier + adjustmentMs),
	) satisfies TimeSchema.Type;
});
