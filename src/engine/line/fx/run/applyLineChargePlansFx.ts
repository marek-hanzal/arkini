import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { spendItemChargesFx } from "~/engine/item/fx/spendItemChargesFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyLineChargePlansFx {
	export interface Props {
		job: JobSchema.Type;
		plan: LineRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

interface ChargeSpend {
	cost: PositiveIntegerSchema.Type;
	depletesIdleItem: boolean;
	itemId: IdSchema.Type;
}

/** Aggregates costs by payer, resolves idle depletions first, and spends each payer once. */
export const applyLineChargePlansFx = Effect.fn("applyLineChargePlansFx")(function* ({
	job,
	plan,
	runtime,
}: applyLineChargePlansFx.Props) {
	const costs = new Map<IdSchema.Type, number>();
	const payerOrder: IdSchema.Type[] = [];
	for (const input of plan.input) {
		if (input.charges === undefined) continue;
		if (!costs.has(input.charges.itemId)) {
			payerOrder.push(input.charges.itemId);
		}
		costs.set(
			input.charges.itemId,
			(costs.get(input.charges.itemId) ?? 0) + input.charges.cost,
		);
	}

	const spends: ChargeSpend[] = [];
	for (const itemId of payerOrder) {
		const cost = costs.get(itemId);
		if (cost === undefined || cost <= 0) {
			return yield* Effect.dieMessage(
				`Charge payer ${itemId} resolved without a positive cost.`,
			);
		}
		const item = yield* readRuntimeItemByIdFx({
			itemId,
			runtime,
		});
		const remainingCharges = yield* readItemRemainingChargesFx(item);
		if (remainingCharges === undefined || remainingCharges < cost) {
			return yield* Effect.dieMessage(
				`Charge payer ${itemId} was applied without sufficient resolved charges.`,
			);
		}
		spends.push({
			cost: cost as PositiveIntegerSchema.Type,
			depletesIdleItem:
				remainingCharges === cost &&
				!runtime.jobs.some((activeJob) => activeJob.ownerItemId === itemId),
			itemId,
		});
	}

	const orderedSpends = [
		...spends.filter(({ depletesIdleItem }) => depletesIdleItem),
		...spends.filter(({ depletesIdleItem }) => !depletesIdleItem),
	];

	return yield* Effect.reduce(orderedSpends, runtime, (draft, spend) => {
		return spendItemChargesFx({
			cost: spend.cost,
			itemId: spend.itemId,
			job,
			runtime: draft,
		});
	});
});
