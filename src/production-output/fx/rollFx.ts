import { Effect, Random } from "effect";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { RollResultSchema } from "~/production-output/schema/RollResultSchema";

/** A chance roll shares one probability check across all its drops. */
export const rollFx = Effect.fn("rollFx")(function* ({ roll }: { readonly roll: RollSchema.Type }) {
	const passed = roll.type === "guaranteed" || (yield* Random.next) < roll.chance;
	return {
		drop: passed ? roll.drop : [],
	} satisfies RollResultSchema.Type;
});
