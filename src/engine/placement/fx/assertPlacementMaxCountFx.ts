import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { readReservedJobOutputQuantityFx } from "~/engine/job/fx/read/readReservedJobOutputQuantityFx";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace assertPlacementMaxCountFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Rejects placement that would exceed one canonical item's global maxCount.
 */
export const assertPlacementMaxCountFx = Effect.fn("assertPlacementMaxCountFx")(function* ({
	drop,
	item,
	runtime,
}: assertPlacementMaxCountFx.Props) {
	if (item.maxCount === undefined) {
		return;
	}

	const existingQuantity = runtime.items.reduce((quantity, candidate) => {
		return candidate.item.id === item.id ? quantity + candidate.quantity : quantity;
	}, 0);
	const reservedQuantity = yield* readReservedJobOutputQuantityFx({
		itemId: item.id,
		runtime,
	});
	const excessQuantity = existingQuantity + reservedQuantity + drop.quantity - item.maxCount;
	if (excessQuantity <= 0) {
		return;
	}

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason: "item:max-count",
			remainingQuantity: excessQuantity,
		}),
	);
});
