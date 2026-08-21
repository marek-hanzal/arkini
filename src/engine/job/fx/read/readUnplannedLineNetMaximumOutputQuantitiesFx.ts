import { Effect } from "effect";

import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { applyFinalChargePayerNetMaximumOutputFx } from "./applyFinalChargePayerNetMaximumOutputFx";
import { clampLineNetMaximumOutputQuantitiesFx } from "./clampLineNetMaximumOutputQuantitiesFx";
import { readLineNetMaximumOutputQuantitiesFx } from "./readLineNetMaximumOutputQuantitiesFx";

export namespace readUnplannedLineNetMaximumOutputQuantitiesFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly owner: RuntimeItemSchema.Type;
	}
}

/**
 * Extends authored line net output with deterministic final-charge owner
 * depletion when an exact input allocation is not ready yet.
 */
export const readUnplannedLineNetMaximumOutputQuantitiesFx = Effect.fn(
	"readUnplannedLineNetMaximumOutputQuantitiesFx",
)(function* ({ line, owner }: readUnplannedLineNetMaximumOutputQuantitiesFx.Props) {
	const quantities = new Map(yield* readLineNetMaximumOutputQuantitiesFx(line));
	const selfChargeCost = line.input.reduce(
		(total, input) =>
			input.charges?.from === InputChargeFromEnumSchema.enum.Self
				? total + input.charges.cost
				: total,
		0,
	);
	const remainingCharges = yield* readItemRemainingChargesFx(owner);
	if (selfChargeCost <= 0 || remainingCharges !== selfChargeCost) {
		return yield* clampLineNetMaximumOutputQuantitiesFx(quantities);
	}

	yield* applyFinalChargePayerNetMaximumOutputFx({
		payer: owner.item,
		quantities,
	});
	return yield* clampLineNetMaximumOutputQuantitiesFx(quantities);
});
