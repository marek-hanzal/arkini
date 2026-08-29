import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { outputFx } from "~/engine/output/fx/outputFx";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { readBoardRuntimeItemByIdFx } from "~/engine/runtime/read/readBoardRuntimeItemByIdFx";

export namespace placeOutputForTestFx {
	export interface Props {
		originItemId: IdSchema.Type;
		output: OutputSchema.Type;
	}
}

/**
 * Keeps atomic placement assertions on the canonical resolver and apply transition.
 */
export const placeOutputForTestFx = Effect.fn("placeOutputForTestFx")(function* ({
	originItemId,
	output,
}: placeOutputForTestFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const origin = yield* readBoardRuntimeItemByIdFx({
				itemId: originItemId,
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
