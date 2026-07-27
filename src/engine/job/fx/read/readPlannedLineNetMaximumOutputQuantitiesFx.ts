import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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

export namespace readPlannedLineNetMaximumOutputQuantitiesFx {
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
export const readPlannedLineNetMaximumOutputQuantitiesFx = Effect.fn(
	"readPlannedLineNetMaximumOutputQuantitiesFx",
)(function* ({ line, plan, runtime }: readPlannedLineNetMaximumOutputQuantitiesFx.Props) {
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
			input.type !== InputEnumSchema.enum.Materials ||
			input.mode !== InputModeEnumSchema.enum.Consume
		) {
			continue;
		}
		for (const allocation of input.item) {
			const item = yield* readRuntimeItemByIdFx({
				itemId: allocation.itemId,
				runtime,
			});
			adjustQuantity(quantities, item.item.id, -allocation.quantity);
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
		if (payer.item.charges?.output !== undefined) {
			const lifecycleOutput = yield* readOutputMaximumQuantitiesFx({
				output: payer.item.charges.output,
			});
			for (const [itemId, quantity] of lifecycleOutput) {
				adjustQuantity(quantities, itemId, quantity);
			}
		}
		adjustQuantity(quantities, payer.item.id, -1);
	}

	return clampNetReservations(quantities);
});
