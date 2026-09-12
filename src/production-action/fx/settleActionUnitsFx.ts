import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { spendActionUnitsFx } from "./spendActionUnitsFx";

interface UnitSpend {
	cost: PositiveIntegerSchema.Type;
	depletesIdleItem: boolean;
	itemId: IdSchema.Type;
}

/** Aggregates resolved costs by payer and commits every mutation to one draft. */
export const settleActionUnitsFx = Effect.fn("settleActionUnitsFx")(function* ({
	actionId,
	units,
	ownerItemId,
	runtime,
}: {
	actionId: IdSchema.Type;
	units: ReadonlyArray<InputRun.UnitPlan>;
	ownerItemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}) {
	const costs = new Map<IdSchema.Type, number>();
	const payerOrder: IdSchema.Type[] = [];
	for (const unit of units) {
		if (!costs.has(unit.itemId)) payerOrder.push(unit.itemId);
		costs.set(unit.itemId, (costs.get(unit.itemId) ?? 0) + unit.cost);
	}

	const spends: UnitSpend[] = [];
	for (const itemId of payerOrder) {
		const cost = costs.get(itemId);
		if (cost === undefined || cost <= 0) {
			return yield* Effect.die(
				new Error(`Unit payer ${itemId} resolved without a positive cost.`),
			);
		}
		const item = yield* readRuntimeItemByIdFx({
			itemId,
			runtime,
		});
		const remainingUnits = readItemRemainingUnitsFn(item);
		if (remainingUnits === undefined || remainingUnits < cost) {
			return yield* Effect.die(
				new Error(`Unit payer ${itemId} was applied without sufficient units.`),
			);
		}
		spends.push({
			cost: cost as PositiveIntegerSchema.Type,
			depletesIdleItem:
				remainingUnits === cost && !runtime.jobs.some((job) => job.ownerItemId === itemId),
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
				const result = yield* spendActionUnitsFx({
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
