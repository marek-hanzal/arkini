import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ModeSchema } from "~/production-input/schema/ModeSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { readItemRemainingChargesFn } from "~/engine/item/fn/readItemRemainingChargesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { LineRun } from "~/production-line/type/LineRun";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { applyFinalChargeReservationFx } from "./applyFinalChargeReservationFx";
import { adjustOutputReservationFx } from "./adjustOutputReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";

export namespace readPlannedOutputReservationFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly plan: LineRun.Plan;
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
						readOutputMaximumQuantitiesFn({
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
			const remainingCharges = readItemRemainingChargesFn(payer);
			if (remainingCharges !== cost) continue;
			yield* applyFinalChargeReservationFx({
				payer: payer.item,
				quantities,
			});
		}

		return yield* clampOutputReservationFx(quantities);
	},
);
