import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";

interface PlaceOutputForTestProps {
	readonly originItemId: IdSchema.Type;
	readonly output: OutcomeTableSchema.Type;
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
			const resolved = yield* resolveOutcomeTableFx({
				ownerItemId: "test-outcome-owner",
				origin: origin.location,
				outcome: output,
			});

			return yield* applyOutcomeTableFx({
				outcome: resolved,
				runtime,
			});
		});
	});
});
