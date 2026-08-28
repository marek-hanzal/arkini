import { Effect } from "effect";

import { TypeSchema } from "~/engine/line/schema/rule/TypeSchema";
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
		return rule.type === TypeSchema.enum.Hide && rule.active;
	});
	const shown =
		line.show ||
		rules.some((rule) => {
			return rule.type === TypeSchema.enum.Show && rule.active;
		});

	return shown && !hidden;
});
