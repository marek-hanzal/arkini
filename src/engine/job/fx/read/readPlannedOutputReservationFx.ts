import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ModeSchema } from "~/engine/input/schema/ModeSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { applyFinalChargeReservationFx } from "./applyFinalChargeReservationFx";
import { adjustOutputReservationFx } from "./adjustOutputReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";

export namespace readPlannedOutputReservationFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly plan: LineRunPlanSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Computes one exact candidate plan's future quantity delta without applying
 * input moves, charge spends, lifecycle output, placement, or identity changes.
 */
export const readPlannedOutputReservationFx = Effect.fn("readPlannedOutputReservationFx")(
	function* ({ line, plan, runtime }: readPlannedOutputReservationFx.Props) {
		const quantities =
			line.output === undefined
				? new Map<IdSchema.Type, number>()
				: new Map(
						yield* readOutputMaximumQuantitiesFx({
							output: line.output,
						}),
					);

		for (const input of plan.input) {
			if (
				input.type !== TypeSchema.enum.Materials ||
				input.mode !== ModeSchema.enum.Consume
			) {
				continue;
			}
			for (const allocation of input.item) {
				const item = yield* readRuntimeItemByIdFx({
					itemId: allocation.itemId,
					runtime,
				});
				yield* adjustOutputReservationFx(quantities, item.item.id, -allocation.quantity);
			}
		}

		const costs = new Map<IdSchema.Type, number>();
		for (const input of plan.input) {
			if (input.charges === undefined) continue;
			costs.set(
				input.charges.itemId,
				(costs.get(input.charges.itemId) ?? 0) + input.charges.cost,
			);
		}
		for (const [payerId, cost] of costs) {
			const payer = yield* readRuntimeItemByIdFx({
				itemId: payerId,
				runtime,
			});
			const remainingCharges = yield* readItemRemainingChargesFx(payer);
			if (remainingCharges !== cost) continue;
			yield* applyFinalChargeReservationFx({
				payer: payer.item,
				quantities,
			});
		}

		return yield* clampOutputReservationFx(quantities);
	},
);
