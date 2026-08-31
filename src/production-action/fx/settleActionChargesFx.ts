import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import { readItemRemainingChargesFn } from "~/production-action/fn/readItemRemainingChargesFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { spendActionChargesFx } from "./spendActionChargesFx";

interface ChargeSpend {
	cost: PositiveIntegerSchema.Type;
	depletesIdleItem: boolean;
	itemId: IdSchema.Type;
}

/** Aggregates resolved costs by payer and commits every mutation to one draft. */
export const settleActionChargesFx = Effect.fn("settleActionChargesFx")(function* ({
	actionId,
	charges,
	ownerItemId,
	runtime,
}: {
	actionId: IdSchema.Type;
	charges: ReadonlyArray<InputRun.ChargePlan>;
	ownerItemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}) {
	const costs = new Map<IdSchema.Type, number>();
	const payerOrder: IdSchema.Type[] = [];
	for (const charge of charges) {
		if (!costs.has(charge.itemId)) payerOrder.push(charge.itemId);
		costs.set(charge.itemId, (costs.get(charge.itemId) ?? 0) + charge.cost);
	}

	const spends: ChargeSpend[] = [];
	for (const itemId of payerOrder) {
		const cost = costs.get(itemId);
		if (cost === undefined || cost <= 0) {
			return yield* Effect.die(
				new Error(`Charge payer ${itemId} resolved without a positive cost.`),
			);
		}
		const item = yield* readRuntimeItemByIdFx({
			itemId,
			runtime,
		});
		const remainingCharges = readItemRemainingChargesFn(item);
		if (remainingCharges === undefined || remainingCharges < cost) {
			return yield* Effect.die(
				new Error(`Charge payer ${itemId} was applied without sufficient charges.`),
			);
		}
		spends.push({
			cost: cost as PositiveIntegerSchema.Type,
			depletesIdleItem:
				remainingCharges === cost &&
				!runtime.jobs.some((job) => job.ownerItemId === itemId),
			itemId,
		});
	}

	const orderedSpends = [
		...spends.filter(({ depletesIdleItem }) => depletesIdleItem),
		...spends.filter(({ depletesIdleItem }) => !depletesIdleItem),
	];
	return yield* Effect.reduce(
		orderedSpends,
		() => ({
			events: [] as GameEventSchema.Type[],
			runtime,
		}),
		(state, spend) =>
			Effect.gen(function* () {
				const result = yield* spendActionChargesFx({
					actionId,
					cost: spend.cost,
					itemId: spend.itemId,
					ownerItemId,
					runtime: state.runtime,
				});
				return {
					events: [
						...state.events,
						...result.events,
					],
					runtime: result.runtime,
				};
			}),
	);
});
