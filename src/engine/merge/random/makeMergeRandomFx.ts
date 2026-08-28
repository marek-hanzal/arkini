import { Effect, Random } from "effect";

import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";

/** Bump only when intentionally changing directional-merge random compatibility. */
const MergeRandomVersion = 2;

const readRemainingChargesSeed = (item: RuntimeItemSchema.Type) => {
	return item.remainingCharges ?? item.item.charges?.amount ?? "full";
};

/** Runs the owned program with deterministic random from stable selected merge facts. */
export const makeMergeRandomFx = Effect.fn("makeMergeRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({
	program,
	rule,
	ruleIndex,
	source,
	target,
}: {
	program: Effect.Effect<Result, Error, Requirements>;
	rule: MergeSchema.Type;
	ruleIndex: number;
	source: RuntimeItemSchema.Type;
	target: RuntimeItemSchema.Type;
}) {
	const result = rule.effect === TargetEffectSchema.enum.Replace ? rule.result : "none";

	return yield* program.pipe(
		Random.withSeed(
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
		),
	);
});
