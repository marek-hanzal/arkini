import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import { adjustLineNetMaximumOutputQuantityFx } from "./adjustLineNetMaximumOutputQuantityFx";

export namespace applyFinalChargePayerNetMaximumOutputFx {
	export interface Props {
		readonly payer: ItemSchema.Type;
		readonly quantities: Map<IdSchema.Type, number>;
	}
}

/**
 * Applies one already-confirmed final-charge payer's lifecycle output and depletion.
 *
 * The caller owns payer selection and final-charge detection. Clamping remains outside this fold so
 * a planned run can combine every exact payer before discarding its non-positive net quantities.
 */
export const applyFinalChargePayerNetMaximumOutputFx = Effect.fn(
	"applyFinalChargePayerNetMaximumOutputFx",
)(function* ({ payer, quantities }: applyFinalChargePayerNetMaximumOutputFx.Props) {
	if (payer.charges?.output !== undefined) {
		const lifecycleOutput = yield* readOutputMaximumQuantitiesFx({
			output: payer.charges.output,
		});
		for (const [itemId, quantity] of lifecycleOutput) {
			yield* adjustLineNetMaximumOutputQuantityFx(quantities, itemId, quantity);
		}
	}
	yield* adjustLineNetMaximumOutputQuantityFx(quantities, payer.id, -1);
});
