import { Effect } from "effect";

import { ChargeSourceSchema } from "~/engine/input/schema/ChargeSourceSchema";
import { readItemRemainingChargesFn } from "~/engine/item/fn/readItemRemainingChargesFn";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { applyFinalChargeReservationFx } from "./applyFinalChargeReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";
import { readOutputReservationFx } from "./readOutputReservationFx";

export namespace readPendingOutputReservationFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly owner: RuntimeItemSchema.Type;
	}
}

/**
 * Extends the pending output reservation with deterministic final-charge owner
 * depletion when an exact input allocation is not ready yet.
 */
export const readPendingOutputReservationFx = Effect.fn("readPendingOutputReservationFx")(
	function* ({ line, owner }: readPendingOutputReservationFx.Props) {
		const quantities = new Map(yield* readOutputReservationFx(line));
		const selfChargeCost = line.input.reduce(
			(total, input) =>
				input.charges?.from === ChargeSourceSchema.enum.Self
					? total + input.charges.cost
					: total,
			0,
		);
		const remainingCharges = readItemRemainingChargesFn(owner);
		if (selfChargeCost <= 0 || remainingCharges !== selfChargeCost) {
			return yield* clampOutputReservationFx(quantities);
		}

		yield* applyFinalChargeReservationFx({
			payer: owner.item,
			quantities,
		});
		return yield* clampOutputReservationFx(quantities);
	},
);
