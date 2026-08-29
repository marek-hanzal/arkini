import { Effect } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import type { ItemDetailInfoProjection } from "~/ui/item-detail/ItemDetailInfoProjection";
import { isSameItemDetailInfoProjectionFn } from "~/ui/item-detail/fn/isSameItemDetailInfoProjectionFn";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readItemDetailInfoFx } from "~/engine/item-detail/read/readItemDetailInfoFx";

export namespace useItemDetailInfo {
	export type Projection = ItemDetailInfoProjection;
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDetailInfo.Projection;

/** Projects the common authored and live facts rendered by the Item Detail Info tab. */
export const useItemDetailInfo = (itemId: IdSchema.Type): useItemDetailInfo.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailInfo.Projection => {
			const info = Effect.runSync(
				readItemDetailInfoFx({
					itemId,
					runtime,
				}),
			);
			if (info.kind === "unavailable") return unavailable;
			return {
				kind: "available",
				itemId: info.itemId,
				description: info.description,
				itemType: info.itemType,
				storageScope: info.storageScope,
				location: info.location,
				quantity: info.quantity,
				maxStackSize: info.maxStackSize,
				ownedQuantity: info.ownedQuantity,
				...(info.maxCount === undefined
					? {}
					: {
							maxCount: info.maxCount,
						}),
				...(info.charges === undefined
					? {}
					: {
							charges: info.charges,
						}),
			};
		},
		[
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, (left, right) =>
		isSameItemDetailInfoProjectionFn({
			left,
			right,
		}),
	);
};
