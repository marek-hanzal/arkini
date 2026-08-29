import type { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { TypeSchema } from "~/engine/line/schema/rule/TypeSchema";

/** Interprets evaluated show and hide rules for one concrete line consumer. */
export const resolveLineShowFn = ({
	line,
	rules,
}: {
	readonly line: Pick<LineSchema.Type, "show">;
	readonly rules: lineRulesFx.Result;
}) => {
	const hidden = rules.some((rule) => rule.type === TypeSchema.enum.Hide && rule.active);
	const shown =
		line.show || rules.some((rule) => rule.type === TypeSchema.enum.Show && rule.active);
	return shown && !hidden;
};
