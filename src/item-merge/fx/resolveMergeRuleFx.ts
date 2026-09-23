import { Effect } from "effect";

import { MergeRuleNotFoundError } from "~/item-merge/error/MergeRuleNotFoundError";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/item-definition/fn/selectItemsFn";

interface ResolveMergeRuleProps {
	readonly source: RuntimeItemSchema.Type;
	readonly target: RuntimeItemSchema.Type;
}

interface ResolveMergeRuleResult {
	readonly index: number;
	readonly rule: MergeSchema.Type;
}

/** Selects a source-owned match first, then the receiving item’s Space variant. Admission failures never retry another rule. */
export const resolveMergeRuleFx = Effect.fn("resolveMergeRuleFx")(function* ({
	source,
	target,
}: ResolveMergeRuleProps) {
	for (const [index, rule] of (source.item.merge ?? []).entries()) {
		if (rule.action === "space") continue;
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

	for (const [index, rule] of (target.item.merge ?? []).entries()) {
		if (rule.action === "space")
			return {
				index,
				rule,
			} satisfies ResolveMergeRuleResult;
	}

	return yield* Effect.fail(
		new MergeRuleNotFoundError({
			sourceItemId: source.id,
			sourceItemUid: source.item.uid,
			targetItemId: target.id,
			targetItemUid: target.item.uid,
		}),
	);
});
