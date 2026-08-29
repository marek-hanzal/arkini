import { Effect } from "effect";

import { MergeRuleNotFoundError } from "~/engine/merge/error/MergeRuleNotFoundError";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { selectItemsFn } from "~/engine/selector/fn/selectItemsFn";

export namespace resolveMergeRuleFx {
	export interface Props {
		source: RuntimeItemSchema.Type;
		target: RuntimeItemSchema.Type;
	}

	export interface Result {
		index: number;
		rule: MergeSchema.Type;
	}
}

/** Resolves the first authored source-owned rule matching one selected target. */
export const resolveMergeRuleFx = Effect.fn("resolveMergeRuleFx")(function* ({
	source,
	target,
}: resolveMergeRuleFx.Props) {
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
			} satisfies resolveMergeRuleFx.Result;
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
