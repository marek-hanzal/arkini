import { Effect } from "effect";

import { RuleEnumSchema } from "~/engine/line/schema/rule/RuleEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RulesResultSchema } from "~/engine/line/schema/rule/RulesResultSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";

export namespace resolveLineRuntimeFx {
	export interface Props {
		line: Pick<LineSchema.Type, "runtimeMs">;
		rules: RulesResultSchema.Type;
	}
}

/**
 * Applies every active runtime multiplier to one line's configured runtime.
 */
export const resolveLineRuntimeFx = Effect.fn("resolveLineRuntimeFx")(function* ({
	line,
	rules,
}: resolveLineRuntimeFx.Props) {
	const multiplier = rules.reduce((value, rule) => {
		return rule.type === RuleEnumSchema.enum.RuntimeMultiplier && rule.active ? value * rule.multiplier : value;
	}, 1);

	return Math.ceil(line.runtimeMs * multiplier) satisfies TimeSchema.Type;
});
