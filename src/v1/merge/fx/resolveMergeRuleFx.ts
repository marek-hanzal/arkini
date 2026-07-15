import { Effect } from "effect";

import { MergeRuleNotFoundError } from "~/v1/merge/error/MergeRuleNotFoundError";
import type { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import { selectorFx } from "~/v1/selector/fx/selectorFx";

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
		const matches = yield* selectorFx({
			selector: rule.target,
			item: target.item,
		});
		if (matches) {
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
