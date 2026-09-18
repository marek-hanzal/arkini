import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import type { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Evaluated rules retain authored order; explain failed enable gates and matching disable vetoes. */
export const readLineBlockingHintsFn = ({
	line,
	rules,
}: {
	readonly line: Pick<LineSchema.Type, "enable" | "rules">;
	readonly rules: lineRulesFx.Result;
}): readonly string[] => {
	if (
		resolveLineEnableFn({
			line,
			rules,
		})
	)
		return [];
	return [
		...new Set(
			line.rules.flatMap((rule, index) => {
				const evaluated = rules[index];
				const blocked =
					evaluated?.type === rule.type &&
					((rule.type === "enable" && !evaluated.active) ||
						(rule.type === "disable" && evaluated.active));
				const hint = rule.hint?.trim();
				return blocked && hint
					? [
							hint,
						]
					: [];
			}),
		),
	];
};
