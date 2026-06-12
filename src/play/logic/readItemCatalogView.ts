import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import { GameConfig } from "~/manifest/data/GameConfig";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ItemCatalogView, ViewItem } from "./playTypes";

const itemCatalogView = createItemCatalogView();

export function readItemCatalogView(): ItemCatalogView {
	return itemCatalogView;
}

function createItemCatalogView(): ItemCatalogView {
	return Object.fromEntries(
		GameConfig.items.map((item) => {
			const asset = gameDataIndex.assetsById.get(item.assetId);
			if (!asset) throw new Error(`Missing asset for ${item.id}`);
			const producer = gameDataIndex.producersByItemId.get(item.id);

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
					producerTrigger: producer?.trigger ?? null,
					canMerge: gameDataIndex.mergeableItemIds.has(item.id as ItemId),
				} satisfies ViewItem,
			];
		}),
	);
}
