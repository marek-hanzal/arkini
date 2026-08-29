import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readOutputReservationFn } from "~/production-job/fn/readOutputReservationFn";
import { resolveOutputCapacityFx } from "./resolveOutputCapacityFx";

export namespace resolveDirectOutputCapacityFx {
	export interface Props {
		readonly additionalReserved?: ReadonlyMap<IdSchema.Type, number>;
		readonly excludedItemIds?: ReadonlySet<IdSchema.Type>;
		readonly line: LineSchema.Type;
		readonly outputReservation?: ReadonlyMap<IdSchema.Type, number>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves worst-case authored direct outputs plus all already active reservations. */
export const resolveDirectOutputCapacityFx = Effect.fn("resolveDirectOutputCapacityFx")(function* ({
	additionalReserved,
	excludedItemIds,
	line,
	outputReservation,
	runtime,
}: resolveDirectOutputCapacityFx.Props) {
	const active = readReservedJobOutputQuantitiesFn({
		runtime,
	});
	const reserved = new Map<IdSchema.Type, number>(
		[
			...active,
		].map(([itemId, reservation]) => [
			itemId,
			reservation.quantity,
		]),
	);
	const direct = outputReservation ?? readOutputReservationFn(line);
	for (const [itemId, quantity] of direct) {
		reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
	}
	for (const [itemId, quantity] of additionalReserved ?? []) {
		reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
	}
	for (const itemId of excludedItemIds ?? []) {
		reserved.delete(itemId);
	}
	return yield* resolveOutputCapacityFx({
		reserved,
		runtime,
	});
});
