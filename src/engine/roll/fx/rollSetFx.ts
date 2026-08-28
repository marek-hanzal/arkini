import { Effect } from "effect";

import type { RollSetResultSchema } from "~/engine/roll/schema/RollSetResultSchema";
import type { SetSchema } from "~/engine/roll/schema/SetSchema";
import { rollFx } from "./rollFx";

export namespace rollSetFx {
	export interface Props {
		rollSet: SetSchema.Type;
	}
}

/**
 * Evaluates every roll in one selected roll set and aggregates unresolved drops.
 */
export const rollSetFx = Effect.fn("rollSetFx")(function* ({ rollSet }: rollSetFx.Props) {
	const results = yield* Effect.forEach(rollSet.roll, (roll) => {
		return rollFx({
			roll,
		});
	});

	return {
		drop: results.flatMap((result) => {
			return result.drop;
		}),
	} satisfies RollSetResultSchema.Type;
});
