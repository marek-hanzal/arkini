import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { readReservedJobOutputQuantitiesFn } from "~/production-job/fn/readReservedJobOutputQuantitiesFn";
import type { dropFx } from "~/production-output/fx/dropFx";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace assertPlacementMaxCountFx {
	export interface Props {
		drop: dropFx.Result;
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
	const reservedQuantity =
		readReservedJobOutputQuantitiesFn({
			runtime,
		}).get(item.id)?.quantity ?? 0;
	const excessQuantity = existingQuantity + reservedQuantity + drop.quantity - item.maxCount;
	if (excessQuantity <= 0) {
		return;
	}

	return yield* Effect.fail(
		new PlacementUnavailableError({
			itemId: drop.itemId,
			placement: drop.placement,
			quantity: drop.quantity,
			reason: PlacementUnavailableError.Reason.ItemMaxCount,
			remainingQuantity: excessQuantity,
		}),
	);
});
