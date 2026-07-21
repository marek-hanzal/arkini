import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

export namespace useItemDefinitionDetail {
	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly subtitle?: string;
				readonly sourceUrl: string;
				readonly compositeUrl?: string;
				readonly description: string;
				readonly itemType: ItemEnumSchema.Type;
				readonly categoryTitle?: string;
				readonly tags: readonly string[];
				readonly storageScope: StorageScopeEnumSchema.Type;
				readonly maxStackSize: number;
				readonly ownedQuantity: number;
				readonly maxCount?: number;
				readonly totalCharges?: number;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDefinitionDetail.Projection;

const sameTags = (left: readonly string[], right: readonly string[]) =>
	left.length === right.length && left.every((tag, index) => tag === right[index]);

const sameProjection = (
	left: useItemDefinitionDetail.Projection,
	right: useItemDefinitionDetail.Projection,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.title === right.title &&
		left.subtitle === right.subtitle &&
		left.sourceUrl === right.sourceUrl &&
		left.compositeUrl === right.compositeUrl &&
		left.description === right.description &&
		left.itemType === right.itemType &&
		left.categoryTitle === right.categoryTitle &&
		sameTags(left.tags, right.tags) &&
		left.storageScope === right.storageScope &&
		left.maxStackSize === right.maxStackSize &&
		left.ownedQuantity === right.ownedQuantity &&
		left.maxCount === right.maxCount &&
		left.totalCharges === right.totalCharges
	);
};

/** Projects authored Item Detail facts for a configured item that has no required live instance. */
export const useItemDefinitionDetail = (
	itemId: IdSchema.Type,
): useItemDefinitionDetail.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDefinitionDetail.Projection => {
			const item = game.config.items[itemId];
			if (item === undefined) return unavailable;
			const categoryTitle = game.config.categories[item.categoryId]?.title;
			return {
				kind: "available",
				itemId: item.id,
				title: item.title,
				...(categoryTitle === undefined
					? {}
					: {
							subtitle: categoryTitle,
							categoryTitle,
						}),
				sourceUrl: game.getResourceUrl(item.asset.source[0]),
				...(item.asset.composite === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(item.asset.composite),
						}),
				description: item.description,
				itemType: item.type,
				tags: [
					...item.tags,
				],
				storageScope: item.scope,
				maxStackSize: item.maxStackSize,
				ownedQuantity: runtime.items.reduce(
					(total, candidate) =>
						candidate.item.id === item.id ? total + candidate.quantity : total,
					0,
				),
				...(item.maxCount === undefined
					? {}
					: {
							maxCount: item.maxCount,
						}),
				...(item.charges === undefined
					? {}
					: {
							totalCharges: item.charges.amount,
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
