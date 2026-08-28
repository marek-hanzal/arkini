import { Effect } from "effect";

import { ChargeSourceSchema } from "~/engine/input/schema/ChargeSourceSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { applyFinalChargeReservationFx } from "./applyFinalChargeReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";
import { readOutputReservationFx } from "./readOutputReservationFx";

export namespace readDefinitionOutputReservationFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly owner: ItemSchema.Type;
	}
}

/** Computes one fresh definition owner's direct and guaranteed lifecycle output reservation. */
export const readDefinitionOutputReservationFx = Effect.fn("readDefinitionOutputReservationFx")(
	function* ({ line, owner }: readDefinitionOutputReservationFx.Props) {
		const quantities = new Map(yield* readOutputReservationFx(line));
		const selfChargeCost = line.input.reduce(
			(total, input) =>
				input.charges?.from === ChargeSourceSchema.enum.Self
					? total + input.charges.cost
					: total,
			0,
		);
		if (selfChargeCost <= 0 || owner.charges?.amount !== selfChargeCost) {
			return yield* clampOutputReservationFx(quantities);
		}
		yield* applyFinalChargeReservationFx({
			payer: owner,
			quantities,
		});
		return yield* clampOutputReservationFx(quantities);
	},
);
