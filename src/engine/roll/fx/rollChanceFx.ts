import { Effect, Random } from "effect";

import type { ChanceSchema } from "~/engine/roll/schema/ChanceSchema";
import type { RollResultSchema } from "~/engine/roll/schema/RollResultSchema";

export namespace rollChanceFx {
	export interface Props {
		roll: ChanceSchema.Type;
	}
}

/**
 * Selects the configured drops when the roll's probability check succeeds.
 */
export const rollChanceFx = Effect.fn("rollChanceFx")(function* ({ roll }: rollChanceFx.Props) {
	const passed = (yield* Random.next) < roll.chance;

	return {
		drop: passed ? roll.drop : [],
	} satisfies RollResultSchema.Type;
});
