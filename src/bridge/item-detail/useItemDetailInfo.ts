import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";
import { readItemDetailInfo } from "~/engine/item-detail/read/readItemDetailInfo";

export namespace useItemDetailInfo {
	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly description: string;
				readonly itemType: ItemEnumSchema.Type;
				readonly categoryTitle?: string;
				readonly tags: readonly string[];
				readonly storageScope: StorageScopeEnumSchema.Type;
				readonly location: readItemDetailInfo.Location;
				readonly quantity: number;
				readonly maxStackSize: number;
				readonly ownedQuantity: number;
				readonly maxCount?: number;
				readonly charges?: {
					readonly remaining: number;
					readonly total: number;
				};
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDetailInfo.Projection;

const sameLocation = (left: readItemDetailInfo.Location, right: readItemDetailInfo.Location) =>
	left.kind === right.kind &&
	(left.kind !== "board" || right.kind !== "board" || left.space === right.space);

const sameTags = (left: readonly string[], right: readonly string[]) =>
	left.length === right.length && left.every((tag, index) => tag === right[index]);

const sameProjection = (
	left: useItemDetailInfo.Projection,
	right: useItemDetailInfo.Projection,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.description === right.description &&
		left.itemType === right.itemType &&
		left.categoryTitle === right.categoryTitle &&
		sameTags(left.tags, right.tags) &&
		left.storageScope === right.storageScope &&
		sameLocation(left.location, right.location) &&
		left.quantity === right.quantity &&
		left.maxStackSize === right.maxStackSize &&
		left.ownedQuantity === right.ownedQuantity &&
		left.maxCount === right.maxCount &&
		left.charges?.remaining === right.charges?.remaining &&
		left.charges?.total === right.charges?.total
	);
};

/** Projects the common authored and live facts rendered by the Item Detail Info tab. */
export const useItemDetailInfo = (itemId: IdSchema.Type): useItemDetailInfo.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailInfo.Projection => {
			const info = readItemDetailInfo({
				itemId,
				runtime,
			});
			if (info.kind === "unavailable") return unavailable;
			const categoryTitle = game.config.categories[info.categoryId]?.title;
			return {
				kind: "available",
				itemId: info.itemId,
				description: info.description,
				itemType: info.itemType,
				...(categoryTitle === undefined
					? {}
					: {
							categoryTitle,
						}),
				tags: info.tags,
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
			game.config.categories,
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
