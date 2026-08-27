import { Effect } from "effect";

import type { OutputResultSchema } from "~/engine/output/schema/OutputResultSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { rollSetFx } from "~/engine/roll/fx/rollSetFx";
import { selectRollSetFx } from "~/engine/roll/fx/selectRollSetFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { dropFx } from "./dropFx";

export namespace outputFx {
	export interface Props {
		origin: GridLocationSchema.Type;
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
		drop: results.filter((result): result is NonNullable<typeof result> => {
			return result !== undefined;
		}),
	} satisfies OutputResultSchema.Type;
});
