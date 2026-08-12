import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { settleItemDeliveryRuntimeFx } from "~/engine/delivery/write/settleItemDeliveryRuntimeFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

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
 * Commits one presentation contact against the exact canonical delivery generation.
 *
 * Missing and superseded completions are ordinary idempotent no-ops. Outbound material is admitted
 * only against current physical input truth; a remainder is reconciled into a return. Returning
 * material may reclaim only its retained origin lease.
 */
export const settleItemDeliveryFx = Effect.fn("settleItemDeliveryFx")(function* ({
	itemId,
	generation,
}: settleItemDeliveryFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		settleItemDeliveryRuntimeFx({
			generation,
			itemId,
			runtime,
		}).pipe(
			Effect.map(
				(settled) =>
					[
						settled.result,
						settled.runtime,
						settled.events,
					] as const,
			),
		),
	);
});
