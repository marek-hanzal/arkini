import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";
import { adjustOutputReservationFx } from "./adjustOutputReservationFx";

export namespace applyFinalChargeReservationFx {
	export interface Props {
		readonly payer: ItemSchema.Type;
		readonly quantities: Map<IdSchema.Type, number>;
	}
}

/**
 * Applies one already-confirmed final-charge payer's lifecycle output and depletion.
 *
 * The caller owns payer selection and final-charge detection. Clamping remains outside this fold so
 * a planned run can combine every exact payer before discarding its non-positive reservation.
 */
export const applyFinalChargeReservationFx = Effect.fn("applyFinalChargeReservationFx")(function* ({
	payer,
	quantities,
}: applyFinalChargeReservationFx.Props) {
	if (payer.charges?.output !== undefined) {
		const lifecycleOutput = readOutputMaximumQuantitiesFn({
			output: payer.charges.output,
		});
		for (const [itemId, quantity] of lifecycleOutput) {
			yield* adjustOutputReservationFx(quantities, itemId, quantity);
		}
	}
	yield* adjustOutputReservationFx(quantities, payer.id, -1);
});
