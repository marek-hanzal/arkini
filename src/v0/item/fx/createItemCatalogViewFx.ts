import { Effect } from "effect";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import { ItemCatalogViewSchema, type ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { toGameActionError } from "~/v0/play/action/toGameActionError";

export namespace createItemCatalogViewFx {
	export interface Props {
		gameConfig: GameConfigService;
	}
}

export const createItemCatalogViewFx = Effect.fn("createItemCatalogViewFx")(function* ({
	gameConfig,
}: createItemCatalogViewFx.Props) {
	return yield* Effect.try({
		try() {
			return ItemCatalogViewSchema.parse(
				Object.fromEntries(
					gameConfig.config.items.map((item) => {
						const asset = gameConfig.getAsset(item.assetId);
						if (!asset) throw new GameActionError(`Missing asset for ${item.id}`);
						const overlayAsset = asset.overlayAssetId
							? gameConfig.getAsset(asset.overlayAssetId)
							: undefined;
						if (asset.overlayAssetId && !overlayAsset) {
							throw new GameActionError(
								`Missing overlay asset for ${item.id}: ${asset.overlayAssetId}`,
							);
						}
						const activation = gameConfig.getActivation(item.id);
						const mergeResults = (item.merge ?? []).map((rule) => ({
							withItemId: rule.withItemId,
							resultItemId: rule.resultItemId,
							secret: rule.secret,
						}));
						const usedInCrafts = gameConfig
							.getCraftRecipesForInput(item.id)
							.map((craft) => ({
								targetItemId: craft.targetItemId,
								resultItemId: craft.resultItemId,
							}));
						const usedInMerges = gameConfig
							.getMergeRulesForInput(item.id)
							.map((rule) => ({
								targetItemId: rule.sourceItemId,
								resultItemId: rule.resultItemId,
								secret: rule.secret,
							}));

						return [
							item.id,
							{
								id: item.id,
								name: item.name,
								description: item.description,
								label: item.label,
								assetSrc: asset.src,
								assetOverlaySrc: overlayAsset?.src,
								assetRender: asset.render ?? "plain",
								maxStackSize: item.maxStackSize,
								tags: [
									...item.tags,
								],
								canProduce: Boolean(activation),
								producerTrigger: activation?.trigger,
								canMerge: gameConfig.isMergeableItem(item.id as ItemId),
								mergeResults,
								usedInCrafts,
								usedInMerges,
							} satisfies ViewItem,
						];
					}),
				),
			) as ItemCatalogView;
		},
		catch: toGameActionError,
	});
});
