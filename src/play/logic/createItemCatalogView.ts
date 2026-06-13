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
					canMerge: gameConfig.isMergeableItem(item.id as ItemId),
				} satisfies ViewItem,
			];
		}),
	);
}
