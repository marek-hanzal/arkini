import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ItemCatalogView, ViewItem } from "~/play/logic/playTypes";
import { GameActionError } from "~/play/logic/playTypes";

export namespace createItemCatalogView {
	export interface Props {
		gameConfig: GameConfigService;
	}
}

export function createItemCatalogView({
	gameConfig,
}: createItemCatalogView.Props): ItemCatalogView {
	return Object.fromEntries(
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
			const producer = gameConfig.getProducer(item.id);
			const mergeResults = (item.merge ?? []).map((rule) => ({
				withItemId: rule.withItemId,
				resultItemId: rule.resultItemId,
				secret: rule.secret,
			}));
			const usedInCrafts = gameConfig.getCraftRecipesForInput(item.id).map((craft) => ({
				targetItemId: craft.targetItemId,
				resultItemId: craft.resultItemId,
			}));
			const usedInMerges = gameConfig.getMergeRulesForInput(item.id).map((rule) => ({
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
					canProduce: Boolean(producer),
					producerTrigger: producer?.trigger,
					canMerge: gameConfig.isMergeableItem(item.id as ItemId),
					mergeResults,
					usedInCrafts,
					usedInMerges,
				} satisfies ViewItem,
			];
		}),
	);
}
