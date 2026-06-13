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

			return [
				item.id,
				{
					id: item.id,
					name: item.name,
					description: item.description,
					label: item.label,
					assetSrc: asset.src,
					maxStackSize: item.maxStackSize,
					tags: [
						...item.tags,
					],
					canProduce: Boolean(producer),
					producerTrigger: producer?.trigger,
					collectible: Boolean(item.collect),
					canMerge: gameConfig.isMergeableItem(item.id as ItemId),
					mergeResults,
					usedInCrafts,
				} satisfies ViewItem,
			];
		}),
	);
}
