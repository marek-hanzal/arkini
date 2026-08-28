import { Effect } from "effect";

import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { applyFinalChargePayerNetMaximumOutputFx } from "./applyFinalChargePayerNetMaximumOutputFx";
import { clampLineNetMaximumOutputQuantitiesFx } from "./clampLineNetMaximumOutputQuantitiesFx";
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
		return yield* clampLineNetMaximumOutputQuantitiesFx(quantities);
	}
	yield* applyFinalChargePayerNetMaximumOutputFx({
		payer: owner,
		quantities,
	});
	return yield* clampLineNetMaximumOutputQuantitiesFx(quantities);
});
