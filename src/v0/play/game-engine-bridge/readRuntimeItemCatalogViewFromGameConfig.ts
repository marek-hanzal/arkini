import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { readRuntimeEffectOperationSummary } from "~/v0/play/game-engine-bridge/readRuntimeEffectOperationSummary";

const catalogCache = new WeakMap<GameConfig, ItemCatalogView>();

const fallbackAssetSrc =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='18' fill='%230f172a'/%3E%3Cpath d='M32 78 58 32h12l26 46-10 18H42z' fill='%23334155'/%3E%3Ccircle cx='64' cy='70' r='12' fill='%2394a3b8'/%3E%3C/svg%3E";

const resourceDataSrc = (data: string | undefined) => {
	if (!data) return undefined;
	if (data.startsWith("data:")) return data;
	return `data:image/png;base64,${data}`;
};

const resolveAssetSrc = ({ assetId, config }: { assetId: string; config: GameConfig }) => {
	const asset = config.assets[assetId];
	if (!asset) return fallbackAssetSrc;

	return resourceDataSrc(config.resources[asset.resourceId]?.data) ?? fallbackAssetSrc;
};

const readGeneratedEffects = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	(config.items[itemId]?.passiveEffectIds ?? []).flatMap((effectId) => {
		const effect = config.effects[effectId];
		if (!effect) return [];

		return [
			{
				id: effectId,
				name: effect.name,
				operations: effect.operations.map((operation) => ({
					kind: operation.kind,
					summary: readRuntimeEffectOperationSummary({
						config,
						operation,
					}),
				})),
				radius: effect.scope === "local" ? effect.radius : undefined,
				scope: effect.scope,
				sourceScope: effect.sourceScope ?? "board",
			},
		];
	});

const readCatalogItem = ({ config, itemId }: { config: GameConfig; itemId: string }): ViewItem => {
	const item = config.items[itemId];
	const asset = config.assets[item.assetId];
	const overlayAssetSrc = asset?.overlayAssetId
		? resolveAssetSrc({
				assetId: asset.overlayAssetId,
				config,
			})
		: undefined;

	return {
		id: itemId as ItemId,
		name: item.name,
		description: item.description,
		label: item.label,
		assetSrc: resolveAssetSrc({
			assetId: item.assetId,
			config,
		}),
		assetOverlaySrc: overlayAssetSrc,
		assetRender: asset?.render ?? "plain",
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
