import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readItemDetailInfoFn } from "~/engine/item-detail/fn/readItemDetailInfoFn";

export namespace useItemDetailInfo {
	export type Projection = readItemDetailInfoFn.Result;
}

/** Projects the common authored and live facts rendered by the Item Detail Info tab. */
export const useItemDetailInfo = (itemId: IdSchema.Type): useItemDetailInfo.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailInfo.Projection =>
			readItemDetailInfoFn({
				itemId,
				runtime,
			}),
		[
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, (left, right) => {
		if (left.kind !== right.kind) return false;
		if (left.kind === "unavailable" || right.kind === "unavailable") return true;
		return (
			left.itemId === right.itemId &&
			left.description === right.description &&
			left.itemType === right.itemType &&
			left.storageScope === right.storageScope &&
			left.location.kind === right.location.kind &&
			(left.location.kind !== "board" ||
				right.location.kind !== "board" ||
				left.location.space === right.location.space) &&
			left.quantity === right.quantity &&
			left.maxStackSize === right.maxStackSize &&
			left.ownedQuantity === right.ownedQuantity &&
			left.maxCount === right.maxCount &&
			left.charges?.remaining === right.charges?.remaining &&
			left.charges?.total === right.charges?.total
		);
	});
};
