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
	const outputReservation =
		plan === undefined
			? yield* readPendingOutputReservationFx({
					line,
					owner,
				})
			: yield* readPlannedOutputReservationFx({
					line,
					plan,
					runtime,
				});
	const active = readReservedJobOutputQuantitiesFn({
		runtime,
	});
	const reserved = new Map(
		[
			...active,
		].map(([itemId, reservation]) => [
			itemId,
			reservation.quantity,
		]),
	);
	for (const [itemId, quantity] of outputReservation) {
		reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
	}
	return yield* resolveOutputCapacityFx({
		reserved,
		runtime,
	});
});
