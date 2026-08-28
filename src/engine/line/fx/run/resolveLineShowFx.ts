import { Effect } from "effect";

import type { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { TypeSchema } from "~/engine/line/schema/rule/TypeSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

export namespace resolveLineShowFx {
	export interface Props {
		line: Pick<LineSchema.Type, "show">;
		rules: lineRulesFx.Result;
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
		return rule.type === TypeSchema.enum.Hide && rule.active;
	});
	const shown =
		line.show ||
		rules.some((rule) => {
			return rule.type === TypeSchema.enum.Show && rule.active;
		});

	return shown && !hidden;
});
