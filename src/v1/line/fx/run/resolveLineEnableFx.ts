import { Effect } from "effect";

import type { LineSchema } from "~/v1/line/schema/LineSchema";
import type { RulesResultSchema } from "~/v1/line/schema/rule/RulesResultSchema";

export namespace resolveLineEnableFx {
	export interface Props {
		line: Pick<LineSchema.Type, "enable">;
		rules: RulesResultSchema.Type;
	}
}

/**
 * Interprets evaluated enable gates and disable vetoes for one line run.
 */
export const resolveLineEnableFx = Effect.fn("resolveLineEnableFx")(function* ({
	line,
	rules,
}: resolveLineEnableFx.Props) {
	const enableRules = rules.filter((rule) => rule.type === "enable");
	const enabled = enableRules.length > 0 ? enableRules.every((rule) => rule.active) : line.enable;
	const disabled = rules.some((rule) => {
		return rule.type === "disable" && rule.active;
	});

	return enabled && !disabled;
});
