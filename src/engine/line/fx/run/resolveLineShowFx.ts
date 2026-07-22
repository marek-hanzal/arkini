import { Effect } from "effect";

import { RuleEnumSchema } from "~/engine/line/schema/rule/RuleEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RulesResultSchema } from "~/engine/line/schema/rule/RulesResultSchema";

export namespace resolveLineShowFx {
	export interface Props {
		line: Pick<LineSchema.Type, "show">;
		rules: RulesResultSchema.Type;
	}
}

/**
 * Interprets evaluated show and hide rules for one concrete line consumer.
 */
export const resolveLineShowFx = Effect.fn("resolveLineShowFx")(function* ({
	line,
	rules,
}: resolveLineShowFx.Props) {
	const hidden = rules.some((rule) => {
		return rule.type === RuleEnumSchema.enum.Hide && rule.active;
	});
	const shown =
		line.show ||
		rules.some((rule) => {
			return rule.type === RuleEnumSchema.enum.Show && rule.active;
		});

	return shown && !hidden;
});
