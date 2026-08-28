import { Effect } from "effect";

import { resolveActionEnableFx } from "~/engine/action/fx/resolveActionEnableFx";
import type { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";

export namespace resolveLineEnableFx {
	export interface Props {
		line: Pick<LineSchema.Type, "enable">;
		rules: lineRulesFx.Result;
	}
}

/**
 * Interprets evaluated enable gates and disable vetoes for one line run.
 */
export const resolveLineEnableFx = Effect.fn("resolveLineEnableFx")(function* ({
	line,
	rules,
}: resolveLineEnableFx.Props) {
	return yield* resolveActionEnableFx({
		enable: line.enable,
		rules: rules.filter((rule) => rule.type === "enable" || rule.type === "disable"),
	});
});
