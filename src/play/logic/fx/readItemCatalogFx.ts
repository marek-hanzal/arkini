import { Effect } from "effect";
import { GameConfig } from "~/manifest/data/GameConfig";
import { gameDataIndex } from "~/manifest/data/gameDataIndex";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ItemCatalogView, ViewItem } from "~/play/logic/playTypes";

const itemCatalogView = createView();

export const readItemCatalogFx = Effect.fn("readItemCatalogFx")(function* () {
	return itemCatalogView;
});

function createView(): ItemCatalogView {
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
					producerTrigger: producer?.trigger,
					canMerge: gameDataIndex.mergeableItemIds.has(item.id as ItemId),
				} satisfies ViewItem,
			];
		}),
	);
}
