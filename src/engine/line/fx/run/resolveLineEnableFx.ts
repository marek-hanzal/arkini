import { Effect } from "effect";

import { resolveActionEnableFx } from "~/engine/action/fx/resolveActionEnableFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RulesResultSchema } from "~/engine/line/schema/rule/RulesResultSchema";

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
	return yield* resolveActionEnableFx({
		enable: line.enable,
		rules: rules.filter((rule) => rule.type === "enable" || rule.type === "disable"),
	});
});
