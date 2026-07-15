import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { outputFx } from "~/v1/output/fx/outputFx";
import type { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { readPlacementOriginFx } from "~/v1/placement/fx/readPlacementOriginFx";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";

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
