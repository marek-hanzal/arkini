import { Effect } from "effect";

import type { RollSetResultSchema } from "~/production-output/schema/RollSetResultSchema";
import type { RollSetSchema } from "~/production-output/schema/RollSetSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { rollFx } from "./rollFx";

export namespace rollSetFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		rollSet: RollSetSchema.Type;
	}
}

/**
 * Evaluates every roll in one selected roll set and aggregates unresolved drops.
 */
export const rollSetFx = Effect.fn("rollSetFx")(function* ({ origin, rollSet }: rollSetFx.Props) {
	const results = yield* Effect.forEach(rollSet.roll, (roll) => {
		return rollFx({
			origin,
			roll,
		});
	});

	return {
		drop: results.flatMap((result) => {
			return result.drop;
		}),
	} satisfies RollSetResultSchema.Type;
});
