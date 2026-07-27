import { Effect } from "effect";

import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import {
	adjustLineNetMaximumOutputQuantity,
	clampLineNetMaximumOutputQuantities,
} from "./lineNetMaximumOutputQuantities";
import { readLineNetMaximumOutputQuantitiesFx } from "./readLineNetMaximumOutputQuantitiesFx";

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
		return clampLineNetMaximumOutputQuantities(quantities);
	}
	if (owner.charges.output !== undefined) {
		const lifecycleOutput = yield* readOutputMaximumQuantitiesFx({
			output: owner.charges.output,
		});
		for (const [itemId, quantity] of lifecycleOutput) {
			adjustLineNetMaximumOutputQuantity(quantities, itemId, quantity);
		}
	}
	adjustLineNetMaximumOutputQuantity(quantities, owner.id, -1);
	return clampLineNetMaximumOutputQuantities(quantities);
});
