import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readReservedJobOutputQuantitiesFx } from "~/engine/job/fx/read/readReservedJobOutputQuantitiesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readLineNetMaximumOutputQuantitiesFx } from "./readLineNetMaximumOutputQuantitiesFx";
import { resolveOutputMaxCountFx } from "./resolveOutputMaxCountFx";

export namespace resolveDirectLineOutputMaxCountFx {
	export interface Props {
		readonly additionalReserved?: ReadonlyMap<IdSchema.Type, number>;
		readonly excludedItemIds?: ReadonlySet<IdSchema.Type>;
		readonly line: LineSchema.Type;
		readonly netOutput?: ReadonlyMap<IdSchema.Type, number>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Resolves worst-case authored direct outputs plus all already active reservations. */
export const resolveDirectLineOutputMaxCountFx = Effect.fn("resolveDirectLineOutputMaxCountFx")(
	function* ({
		additionalReserved,
		excludedItemIds,
		line,
		netOutput,
		runtime,
	}: resolveDirectLineOutputMaxCountFx.Props) {
		const active = yield* readReservedJobOutputQuantitiesFx({
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
		const direct = netOutput ?? (yield* readLineNetMaximumOutputQuantitiesFx(line));
		for (const [itemId, quantity] of direct) {
			reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
		}
		for (const [itemId, quantity] of additionalReserved ?? []) {
			reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
		}
		for (const itemId of excludedItemIds ?? []) {
			reserved.delete(itemId);
		}
		return yield* resolveOutputMaxCountFx({
			reserved,
			runtime,
		});
	},
);
