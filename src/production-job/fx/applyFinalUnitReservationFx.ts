import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";
import { adjustOutputReservationFx } from "./adjustOutputReservationFx";

export namespace applyFinalUnitReservationFx {
	export interface Props {
		readonly payer: ItemSchema.Type;
		readonly quantities: Map<IdSchema.Type, number>;
	}
}

/**
 * Applies one already-confirmed final-unit payer's lifecycle output and depletion.
 *
 * The caller owns payer selection and final-unit detection. Clamping remains outside this fold so
 * a planned run can combine every exact payer before discarding its non-positive reservation.
 */
export const applyFinalUnitReservationFx = Effect.fn("applyFinalUnitReservationFx")(function* ({
	payer,
	quantities,
}: applyFinalUnitReservationFx.Props) {
	if (payer.units?.output !== undefined) {
		const lifecycleOutput = readOutputMaximumQuantitiesFn({
			output: payer.units.output,
		});
		for (const [itemId, quantity] of lifecycleOutput) {
			yield* adjustOutputReservationFx(quantities, itemId, quantity);
		}
	}
	yield* adjustOutputReservationFx(quantities, payer.id, -1);
});
