import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { outputFx } from "~/engine/output/fx/outputFx";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { readPlacementOriginFx } from "~/engine/placement/fx/readPlacementOriginFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

export namespace placeOutputFx {
	export interface Props {
		originItemId: IdSchema.Type;
		output: OutputSchema.Type;
	}
}

/**
 * Atomically resolves and places one configured output from the latest runtime snapshot.
 */
export const placeOutputFx = Effect.fn("placeOutputFx")(function* ({
	originItemId,
	output,
}: placeOutputFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const origin = yield* readPlacementOriginFx({
				originItemId,
				runtime,
			});
			const resolved = yield* outputFx({
				origin: origin.location,
				output,
			});

			return yield* applyOutputPlacementFx({
				origin: origin.location,
				output: resolved,
				runtime,
			});
		});
	});
});
