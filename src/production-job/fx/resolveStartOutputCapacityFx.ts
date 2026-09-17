import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { UnitSourceSchema } from "~/production-input/schema/UnitSourceSchema";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import type { LineRun } from "~/production-line/type/LineRun";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readOutputReservationFn } from "~/production-job/fn/readOutputReservationFn";
import { applyFinalUnitReservationFx } from "./applyFinalUnitReservationFx";
import { clampOutputReservationFx } from "./clampOutputReservationFx";
import { readPlannedOutputReservationFx } from "./readPlannedOutputReservationFx";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import { resolveOutputCapacityFx } from "./resolveOutputCapacityFx";

const readActiveOutputReservationsFn = ({
	plan,
	runtime,
}: {
	readonly plan: LineRun.Plan | undefined;
	readonly runtime: RuntimeSchema.Type;
}) => {
	if (plan === undefined)
		return readReservedJobOutputQuantitiesFn({
			runtime,
		});
	const costs = new Map<IdSchema.Type, number>();
	for (const input of plan.input) {
		if (input.units === undefined) continue;
		costs.set(input.units.itemId, (costs.get(input.units.itemId) ?? 0) + input.units.cost);
	}
	const activeOwnerIds = new Set(runtime.jobs.map((job) => job.ownerItemId));
	// Project only deferred external depletion into the existing job's reservation.
	// Its consumed material and owner-removal credit belong to that completion,
	// independently of the candidate's output and completion order.
	return readReservedJobOutputQuantitiesFn({
		runtime: {
			...runtime,
			items: runtime.items.map((item) =>
				item.id !== plan.ownerItemId &&
				activeOwnerIds.has(item.id) &&
				costs.has(item.id) &&
				readItemRemainingUnitsFn(item) === costs.get(item.id)
					? {
							...item,
							remainingUnits: 0,
						}
					: item,
			),
		},
	});
};

const readPendingOutputReservationFx = Effect.fn("readPendingOutputReservationFx")(function* ({
	line,
	owner,
}: {
	readonly line: LineSchema.Type;
	readonly owner: RuntimeItemSchema.Type;
}) {
	const quantities = new Map(readOutputReservationFn(line));
	const selfUnitCost = line.input.reduce(
		(total, input) =>
			input.units?.from === UnitSourceSchema.enum.Self ? total + input.units.cost : total,
		0,
	);
	const remainingUnits = readItemRemainingUnitsFn(owner);
	if (selfUnitCost <= 0 || remainingUnits !== selfUnitCost) {
		return yield* clampOutputReservationFx(quantities);
	}

	yield* applyFinalUnitReservationFx({
		payer: owner.item,
		quantities,
	});
	return yield* clampOutputReservationFx(quantities);
});

export namespace resolveStartOutputCapacityFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: LineRun.Plan | undefined;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves candidate output plus active-job reservations for reads and admission. */
export const resolveStartOutputCapacityFx = Effect.fn("resolveStartOutputCapacityFx")(function* ({
	lineId,
	ownerItemId,
	plan,
	runtime,
}: resolveStartOutputCapacityFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const line = readItemLineFn({
		item: owner.item,
		lineId,
	});
	if (line === undefined) return undefined;
	const outputReservation: readPlannedOutputReservationFx.Result =
		plan === undefined
			? {
					quantities: yield* readPendingOutputReservationFx({
						line,
						owner,
					}),
					discardedItemIds: new Set(),
				}
			: yield* readPlannedOutputReservationFx({
					line,
					plan,
					runtime,
				});
	const capacityRuntime =
		outputReservation.discardedItemIds.size === 0
			? runtime
			: {
					...runtime,
					items: runtime.items.filter(
						(item) => !outputReservation.discardedItemIds.has(item.id),
					),
				};
	const active = readActiveOutputReservationsFn({
		plan,
		runtime: capacityRuntime,
	});
	const reserved = new Map(
		[
			...active,
		].map(([itemId, reservation]) => [
			itemId,
			reservation.quantity,
		]),
	);
	for (const [itemId, quantity] of outputReservation.quantities) {
		reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
	}
	return yield* resolveOutputCapacityFx({
		reserved,
		runtime: capacityRuntime,
	});
});
