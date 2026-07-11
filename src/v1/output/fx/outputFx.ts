import { Effect } from "effect";

import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import type { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { rollSetFx } from "~/v1/roll/fx/rollSetFx";
import { selectRollSetFx } from "~/v1/roll/fx/selectRollSetFx";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import { dropFx } from "./dropFx";

export namespace outputFx {
	export interface Props {
		origin: PositionSchema.Type;
		output: OutputSchema.Type;
	}
}

/**
 * Selects one configured roll set and resolves all of its selected drops.
 */
export const outputFx = Effect.fn("outputFx")(function* ({ origin, output }: outputFx.Props) {
	const selectedSet = yield* selectRollSetFx({
		set: output.set,
	});
	const rollSetResult = yield* rollSetFx({
		rollSet: selectedSet,
	});
	const results = yield* Effect.forEach(rollSetResult.drop, (drop) => {
		return dropFx({
			drop,
			origin,
		});
	});

	return {
		drop: results.flat(),
	} satisfies OutputResultSchema.Type;
});
