import { Effect, Random } from "effect";
import type { RollSchema } from "~/outcome/schema/RollSchema";

/** A chance roll shares one probability check across all its outcomes. */
export const rollFx = Effect.fn("rollFx")(function* ({ roll }: { readonly roll: RollSchema.Type }) {
	const passed = roll.type === "guaranteed" || (yield* Random.next) < roll.chance;
	return passed ? roll.outcome : [];
});
