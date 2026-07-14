import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { readReservedJobOutputQuantityFx } from "~/v1/job/fx/read/readReservedJobOutputQuantityFx";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import { PlacementUnavailableError } from "~/v1/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace assertPlacementMaxCountFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		removeItemId?: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Rejects placement that would exceed one canonical item's global maxCount.
 */
export const assertPlacementMaxCountFx = Effect.fn("assertPlacementMaxCountFx")(function* ({
	drop,
	item,
	removeItemId,
	runtime,
}: assertPlacementMaxCountFx.Props) {
	if (item.maxCount === undefined) {
		return;
	}

	const existingQuantity = runtime.items.reduce((quantity, candidate) => {
		if (candidate.id === removeItemId || candidate.item.id !== item.id) {
			return quantity;
		}

		return quantity + candidate.quantity;
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
