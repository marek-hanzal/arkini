import type { GameConfig } from "~/config/GameConfigTypes";
import { readGameConfigAssetSrc } from "~/config/readGameConfigAssetSrc";
import type { ItemId } from "~/config/GameIdSchema";
import { isPlayerVisibleGeneratedEffect } from "~/play/game-engine-bridge/isPlayerVisibleGeneratedEffect";
import type { ViewItem, ViewItemAsset } from "~/item/view/ViewItemSchema";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";

const catalogCache = new WeakMap<GameConfig, ItemCatalogView>();

const fallbackAssetSrc =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='18' fill='%230f172a'/%3E%3Cpath d='M32 78 58 32h12l26 46-10 18H42z' fill='%23334155'/%3E%3Ccircle cx='64' cy='70' r='12' fill='%2394a3b8'/%3E%3C/svg%3E";

const resolveAssetSrc = ({ assetId, config }: { assetId: string; config: GameConfig }) =>
	readGameConfigAssetSrc({
		assetId,
		config,
	}) ?? fallbackAssetSrc;

const readGeneratedEffects = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	(config.items[itemId]?.effects ?? []).filter(isPlayerVisibleGeneratedEffect).map((effect) => ({
		id: effect.id,
		name: effect.name,
		polarity: effect.polarity,
		grants: effect.grants.map((grant) => ({
			id: grant.id,
			name: grant.name,
		})),
		sourceScope: effect.sourceScope ?? "board",
	}));

const readCatalogItemAsset = ({
	assetId,
	config,
}: {
	assetId: string;
	config: GameConfig;
}): ViewItemAsset => {
	const asset = config.assets[assetId];
	const overlaySrc = asset?.overlayAssetId
		? resolveAssetSrc({
				assetId: asset.overlayAssetId,
				config,
			})
		: undefined;

	return {
		src: resolveAssetSrc({
			assetId,
			config,
		}),
		overlaySrc,
		render: asset?.render ?? "plain",
	};
};

const readCatalogItem = ({ config, itemId }: { config: GameConfig; itemId: string }): ViewItem => {
	const item = config.items[itemId];

	return {
		id: itemId as ItemId,
		name: item.name,
		description: item.description,
		label: item.label,
		assets: item.assetIds.map((assetId) =>
			readCatalogItemAsset({
				assetId,
				config,
			}),
		),
		maxStackSize: item.maxStackSize,
		storage: item.storage,
		tags: [
			...item.tags,
		],
		generatedEffects: readGeneratedEffects({
			config,
			itemId,
		}),
	};
};

export const readRuntimeItemCatalogViewFromGameConfig = (config: GameConfig): ItemCatalogView => {
	const cached = catalogCache.get(config);
	if (cached) return cached;

	const catalog = Object.fromEntries(
		Object.keys(config.items).map((itemId) => [
			itemId,
			readCatalogItem({
				config,
				itemId,
			}),
		]),
	) as ItemCatalogView;

	catalogCache.set(config, catalog);
	return catalog;
};
