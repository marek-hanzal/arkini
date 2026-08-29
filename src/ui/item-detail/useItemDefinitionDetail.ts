import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { StorageSchema } from "~/engine/scope/schema/StorageSchema";

export namespace useItemDefinitionDetail {
	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly sourceUrl: string;
				readonly compositeUrl?: string;
				readonly description: string;
				readonly itemType: TypeSchema.Type;
				readonly storageScope: StorageSchema.Type;
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

/** Projects authored Item Detail facts for a configured item that has no required live instance. */
export const useItemDefinitionDetail = (
	itemId: IdSchema.Type,
): useItemDefinitionDetail.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDefinitionDetail.Projection => {
			const item = game.config.items[itemId];
			if (item === undefined) return unavailable;
			return {
				kind: "available",
				itemId: item.id,
				title: item.title,
				sourceUrl: game.getResourceUrl(item.asset.default[0]),
				...(item.asset.default[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(item.asset.default[1]),
						}),
				description: item.description,
				itemType: item.type,
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
	return useRuntimeSelector(game, selector, Equal.equals);
};
