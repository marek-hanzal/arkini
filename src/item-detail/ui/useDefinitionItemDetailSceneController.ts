import type { readItemDetailScheduleFx } from "~/item-detail-read/fx/readItemDetailScheduleFx";
import { Equal } from "effect";
import { useCallback } from "react";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import type { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const unavailable = {
	kind: "unavailable",
} as const;

export namespace useDefinitionItemDetailSceneController {
	export type Target = Extract<
		ItemDetailTarget,
		{
			readonly kind: "definition";
		}
	>;

	export type DefinitionProjection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly sourceUrl: string;
				readonly compositeUrl?: string;
				readonly description?: string;
				readonly schedule?: readItemDetailScheduleFx.Schedule;
				readonly storageScope: StorageSchema.Type;
				readonly maxStackSize: number;
				readonly ownedQuantity: number;
				readonly maxCount?: number;
				readonly totalUnits?: number;
		  }
		| {
				readonly kind: "unavailable";
		  };

	export interface Props {
		readonly target: Target;
	}

	export interface Output {
		readonly definition: DefinitionProjection;
	}
}

const useItemDefinitionDetail = (
	itemId: IdSchema.Type,
): useDefinitionItemDetailSceneController.DefinitionProjection => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(
			runtime: RuntimeSchema.Type,
		): useDefinitionItemDetailSceneController.DefinitionProjection => {
			const item = game.config.items[itemId];
			if (item === undefined) return unavailable;
			return {
				kind: "available",
				itemId: item.id,
				title: item.title,
				sourceUrl: game.getResourceUrlFn(item.artwork.default[0]),
				...(item.artwork.default[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrlFn(item.artwork.default[1]),
						}),
				description: item.description,
				schedule:
					item.clock !== undefined
						? {
								intervalMs: item.clock.intervalMs,
								durationMs: item.clock.durationMs,
								control: item.control ?? "interactive",
							}
						: undefined,
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
				...(item.units === undefined
					? {}
					: {
							totalUnits: item.units.amount,
						}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selectorFn, Equal.equals);
};

/** Projects the configured item facts shown by one definition detail scene. */
export const useDefinitionItemDetailSceneController = ({
	target,
}: useDefinitionItemDetailSceneController.Props): useDefinitionItemDetailSceneController.Output => ({
	definition: useItemDefinitionDetail(target.itemId),
});
