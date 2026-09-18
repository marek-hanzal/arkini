import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import type { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Explain only the first blocker in authored order, even when it has no hint. */
export const readLineBlockingHintFn = ({
	line,
	rules,
}: {
	readonly line: Pick<LineSchema.Type, "enable" | "rules">;
	readonly rules: lineRulesFx.Result;
}): string | undefined => {
	if (
		resolveLineEnableFn({
			line,
			rules,
		})
	)
		return undefined;
	const blocker = line.rules.find((rule, index) => {
		const evaluated = rules[index];
		return (
			evaluated?.type === rule.type &&
			((rule.type === "enable" && !evaluated.active) ||
				(rule.type === "disable" && evaluated.active))
		);
	});
	return blocker?.hint?.trim() || undefined;
};
