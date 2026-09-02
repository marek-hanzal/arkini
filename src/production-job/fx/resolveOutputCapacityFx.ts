import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveOutputCapacityFx {
	export interface Props {
		readonly reserved: ReadonlyMap<IdSchema.Type, number>;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Block {
		readonly itemId: IdSchema.Type;
		readonly liveQuantity: number;
		readonly reservedQuantity: PositiveIntegerSchema.Type;
		readonly maxCount: PositiveIntegerSchema.Type;
		readonly excessQuantity: PositiveIntegerSchema.Type;
	}
}

/** Resolves the first deterministic canonical maxCount violation for future output. */
export const resolveOutputCapacityFx = Effect.fn("resolveOutputCapacityFx")(function* ({
	reserved,
	runtime,
}: resolveOutputCapacityFx.Props) {
	for (const itemId of [
		...reserved.keys(),
	].sort()) {
		const reservedQuantity = reserved.get(itemId) ?? 0;
		if (reservedQuantity <= 0) continue;
		const item = yield* resolveItemFx({
			itemId,
		});
		if (item.maxCount === undefined) continue;

		const liveQuantity = runtime.items.reduce(
			(quantity, candidate) =>
				candidate.item.id === itemId ? quantity + candidate.quantity : quantity,
			0,
		);
		const excessQuantity = liveQuantity + reservedQuantity - item.maxCount;
		if (excessQuantity <= 0) continue;

		return {
			itemId,
			liveQuantity,
			reservedQuantity: reservedQuantity as PositiveIntegerSchema.Type,
			maxCount: item.maxCount,
			excessQuantity: excessQuantity as PositiveIntegerSchema.Type,
		} satisfies resolveOutputCapacityFx.Block;
	}
	return undefined;
});
