import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { readLineNetMaximumOutputQuantitiesFx } from "./readLineNetMaximumOutputQuantitiesFx";

export namespace readUnplannedLineNetMaximumOutputQuantitiesFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly owner: RuntimeItemSchema.Type;
	}
}

const clampNetReservations = (quantities: Map<IdSchema.Type, number>) => {
	for (const [itemId, quantity] of quantities) {
		if (quantity <= 0) quantities.delete(itemId);
	}
	return quantities;
};

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
		return clampNetReservations(quantities);
	}

	if (owner.item.charges?.output !== undefined) {
		const depletionOutput = yield* readOutputMaximumQuantitiesFx({
			output: owner.item.charges.output,
		});
		for (const [itemId, quantity] of depletionOutput) {
			quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
		}
	}
	const ownerNetQuantity = (quantities.get(owner.item.id) ?? 0) - 1;
	if (ownerNetQuantity === 0) quantities.delete(owner.item.id);
	else quantities.set(owner.item.id, ownerNetQuantity);
	return clampNetReservations(quantities) satisfies Map<IdSchema.Type, number>;
});
