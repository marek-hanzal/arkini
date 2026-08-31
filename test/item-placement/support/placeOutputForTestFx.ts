import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { outputFx } from "~/production-output/fx/outputFx";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";

interface PlaceOutputForTestProps {
	readonly originItemId: IdSchema.Type;
	readonly output: OutputSchema.Type;
}

/**
 * Keeps atomic placement assertions on the canonical resolver and apply transition.
 */
export const placeOutputForTestFx = Effect.fn("placeOutputForTestFx")(function* ({
	originItemId,
	output,
}: PlaceOutputForTestProps) {
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
