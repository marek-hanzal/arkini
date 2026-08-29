import { resolveActionEnableFn } from "~/engine/action/fn/resolveActionEnableFn";
import type { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

/** Interprets evaluated enable gates and disable vetoes for one line run. */
export const resolveLineEnableFn = ({
	line,
	rules,
}: {
	readonly line: Pick<LineSchema.Type, "enable">;
	readonly rules: lineRulesFx.Result;
}) =>
	resolveActionEnableFn({
		enable: line.enable,
		rules: rules.filter((rule) => rule.type === "enable" || rule.type === "disable"),
	});
