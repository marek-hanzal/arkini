import type { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { RuleTypeSchema } from "~/production-line/schema/RuleTypeSchema";

/** Interprets evaluated show and hide rules for one concrete line consumer. */
export const resolveLineShowFn = ({
	line,
	rules,
}: {
	readonly line: Pick<LineSchema.Type, "show">;
	readonly rules: lineRulesFx.Result;
}) => {
	const hidden = rules.some((rule) => rule.type === RuleTypeSchema.enum.Hide && rule.active);
	const shown =
		line.show || rules.some((rule) => rule.type === RuleTypeSchema.enum.Show && rule.active);
	return shown && !hidden;
};
