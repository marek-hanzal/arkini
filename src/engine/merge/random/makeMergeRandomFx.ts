import { Effect, Random } from "effect";

import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

/** Bump only when intentionally changing directional-merge random compatibility. */
export const MergeRandomVersion = 1;

const readRemainingChargesSeed = (item: RuntimeItemSchema.Type) => {
	return item.remainingCharges ?? item.item.charges?.amount ?? "full";
};

/** Creates one deterministic random stream from stable selected merge facts. */
export const makeMergeRandomFx = Effect.fn("makeMergeRandomFx")(function* ({
	rule,
	ruleIndex,
	source,
	target,
}: {
	rule: MergeSchema.Type;
	ruleIndex: number;
	source: RuntimeItemSchema.Type;
	target: RuntimeItemSchema.Type;
}) {
	const result = rule.effect === "replace" ? rule.result : "none";

	return Random.make(
		[
			"arkini:merge",
			`v${MergeRandomVersion}`,
			source.id,
			source.item.id,
			source.quantity,
			readRemainingChargesSeed(source),
			target.id,
			target.item.id,
			target.quantity,
			readRemainingChargesSeed(target),
			ruleIndex,
			rule.action,
			rule.effect,
			result,
		].join(":"),
	);
});
