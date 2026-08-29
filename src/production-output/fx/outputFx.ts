import { Effect } from "effect";

import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { rollSetFx } from "~/production-output/roll/fx/rollSetFx";
import { selectRollSetFx } from "~/production-output/roll/fx/selectRollSetFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { dropFx } from "./dropFx";

export namespace outputFx {
	export interface Props {
		origin: GridLocationSchema.Type;
		output: OutputSchema.Type;
	}

	export interface Result {
		readonly drop: ReadonlyArray<dropFx.Result>;
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
		drop: results.filter((result): result is NonNullable<typeof result> => {
			return result !== undefined;
		}),
	} satisfies outputFx.Result;
});
