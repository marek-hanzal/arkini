import { Effect } from "effect";

import { MergeRuleNotFoundError } from "~/item-merge/error/MergeRuleNotFoundError";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";

interface ResolveMergeRuleProps {
	readonly source: RuntimeItemSchema.Type;
	readonly target: RuntimeItemSchema.Type;
}

interface ResolveMergeRuleResult {
	readonly index: number;
	readonly rule: MergeSchema.Type;
}

/** Resolves the first authored source-owned rule matching one selected target. */
export const resolveMergeRuleFx = Effect.fn("resolveMergeRuleFx")(function* ({
	source,
	target,
}: ResolveMergeRuleProps) {
	for (const [index, rule] of (source.item.merge ?? []).entries()) {
		const matches = selectItemsFn({
			items: [
				target.item,
			],
			selector: rule.target,
		});
		if (matches.length > 0) {
			return {
				index,
				rule,
			} satisfies ResolveMergeRuleResult;
		}
	}

	return yield* Effect.fail(
		new MergeRuleNotFoundError({
			sourceItemId: source.id,
			sourceCanonicalItemId: source.item.id,
			targetItemId: target.id,
			targetCanonicalItemId: target.item.id,
		}),
	);
});
