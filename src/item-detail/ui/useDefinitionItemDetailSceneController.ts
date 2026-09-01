import { Equal } from "effect";
import { useCallback, useEffect } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { useItemDetailNavigationController } from "~/item-detail/ui/useItemDetailNavigationController";
import type { StorageSchema } from "~/item-definition/schema/StorageSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
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

	export interface Props {
		readonly target: Target;
	}

	export interface Output {
		readonly definition: DefinitionProjection;
		readonly sources: useItemDetailNavigationController.SourcesProjection;
		readonly tabs: useItemDetailNavigationController.Output["tabs"];
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
				sourceUrl: game.getResourceUrlFn(item.asset.default[0]),
				...(item.asset.default[1] === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrlFn(item.asset.default[1]),
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
	return useRuntimeSelector(game, selectorFn, Equal.equals);
};

/** Projects one definition scene and repairs a tab that its current source graph no longer admits. */
export const useDefinitionItemDetailSceneController = ({
	target,
}: useDefinitionItemDetailSceneController.Props): useDefinitionItemDetailSceneController.Output => {
	const definition = useItemDefinitionDetail(target.itemId);
	const navigation = useItemDetailNavigationController({
		target: {
			kind: "definition",
			itemId: target.itemId,
		},
	});
	const itemDetail = useItemDetailControl();

	useEffect(() => {
		if (navigation.tabs.includes(target.tab)) return;
		RendererRuntime.runSync(
			itemDetail.openItemDefinitionDetailFx({
				itemId: target.itemId,
			}),
		);
	}, [
		itemDetail,
		navigation.tabs,
		target.itemId,
		target.tab,
	]);

	return {
		definition,
		sources: navigation.sources,
		tabs: navigation.tabs,
	};
};
