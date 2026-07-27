import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import { readLineNetMaximumOutputQuantitiesFx } from "./readLineNetMaximumOutputQuantitiesFx";

const adjustQuantity = (
	quantities: Map<IdSchema.Type, number>,
	itemId: IdSchema.Type,
	delta: number,
) => {
	const quantity = (quantities.get(itemId) ?? 0) + delta;
	if (quantity === 0) quantities.delete(itemId);
	else quantities.set(itemId, quantity);
};

const clampNetReservations = (quantities: Map<IdSchema.Type, number>) => {
	for (const [itemId, quantity] of quantities) {
		if (quantity <= 0) quantities.delete(itemId);
	}
	return quantities;
};

export namespace readDefinitionLineNetMaximumOutputQuantitiesFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly owner: ItemSchema.Type;
	}
}

/** Computes one fresh definition owner's direct and guaranteed lifecycle net output. */
export const readDefinitionLineNetMaximumOutputQuantitiesFx = Effect.fn(
	"readDefinitionLineNetMaximumOutputQuantitiesFx",
)(function* ({ line, owner }: readDefinitionLineNetMaximumOutputQuantitiesFx.Props) {
	const quantities = new Map(yield* readLineNetMaximumOutputQuantitiesFx(line));
	const selfChargeCost = line.input.reduce(
		(total, input) =>
			input.charges?.from === InputChargeFromEnumSchema.enum.Self
				? total + input.charges.cost
				: total,
		0,
	);
	if (selfChargeCost <= 0 || owner.charges?.amount !== selfChargeCost) {
		return clampNetReservations(quantities);
	}
	if (owner.charges.output !== undefined) {
		const lifecycleOutput = yield* readOutputMaximumQuantitiesFx({
			output: owner.charges.output,
		});
		for (const [itemId, quantity] of lifecycleOutput) {
			adjustQuantity(quantities, itemId, quantity);
		}
	}
	adjustQuantity(quantities, owner.id, -1);
	return clampNetReservations(quantities);
});
