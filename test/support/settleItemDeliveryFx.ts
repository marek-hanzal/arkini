import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { settleItemDeliveryRuntimeFx } from "~/production-delivery/fx/settleItemDeliveryRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace settleItemDeliveryFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly generation: NonNegativeIntegerSchema.Type;
	}

	export interface Result {
		readonly acceptedQuantity: number;
		readonly status: "ignored" | "returned" | "stored";
	}
}

/**
 * Commits one canonical delivery contact against the exact delivery generation.
 *
 * Missing and superseded requests are ordinary idempotent no-ops. Outbound material is admitted
 * only against current physical input truth after engine-owned travel reaches its contact boundary;
 * a remainder is reconciled into a return. Returning material may reclaim only its retained origin
 * lease.
 */
export const settleItemDeliveryFx = Effect.fn("settleItemDeliveryFx")(function* ({
	itemId,
	generation,
}: settleItemDeliveryFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		settleItemDeliveryRuntimeFx({
			itemId,
			generation,
			runtime,
		}),
	);
});
