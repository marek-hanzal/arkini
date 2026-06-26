import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { resolveExecutableItemMergeRule } from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";

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

const readMergeResults = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	Object.keys(config.items).flatMap((targetItemId) => {
		const executable = resolveExecutableItemMergeRule({
			config,
			sourceItemId: itemId,
			targetItemId,
		});
		if (!executable) return [];

		return [
			{
				withItemId: targetItemId as ItemId,
				resultItemId: executable.merge.resultItemId as ItemId,
				secret: executable.merge.secret,
			},
		];
	});

const readUsedInMerges = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	Object.keys(config.items).flatMap((sourceItemId) => {
		const executable = resolveExecutableItemMergeRule({
			config,
			sourceItemId,
			targetItemId: itemId,
		});
		if (!executable) return [];

		const reverseExecutable = resolveExecutableItemMergeRule({
			config,
			sourceItemId: itemId,
			targetItemId: sourceItemId,
		});
		if (reverseExecutable?.merge.resultItemId === executable.merge.resultItemId) {
			return [];
		}

		return [
			{
				targetItemId: sourceItemId as ItemId,
				resultItemId: executable.merge.resultItemId as ItemId,
				secret: executable.merge.secret,
			},
		];
	});

const readUsedInCrafts = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	Object.entries(config.items).flatMap(([targetItemId, targetItem]) => {
		const recipe = targetItem.craftRecipeId
			? config.craftRecipes[targetItem.craftRecipeId]
			: undefined;
		if (!recipe?.inputs.some((input) => input.itemId === itemId)) return [];

		return [
			{
				targetItemId: targetItemId as ItemId,
				resultItemId: recipe.resultItemId as ItemId,
			},
		];
	});

const isMergeableItem = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	Object.values(config.merge).some(
		(rule) => rule.resultItemId === itemId || rule.withItemId === itemId,
	) || Boolean(config.items[itemId]?.mergeIds?.length);

const readEffectTargetSummary = (
	target: GameConfig["effects"][string]["operations"][number]["target"],
) => {
	if ("all" in target && target.all) return "all targets";
	const parts = [];
	if ("producerIds" in target && target.producerIds?.length) {
		parts.push(`producers ${target.producerIds.join(", ")}`);
	}
	if ("productIds" in target && target.productIds?.length) {
		parts.push(`products ${target.productIds.join(", ")}`);
	}
	if ("producerTagsAny" in target && target.producerTagsAny?.length) {
		parts.push(`producer tag any ${target.producerTagsAny.join(", ")}`);
	}
	if ("producerTagsAll" in target && target.producerTagsAll?.length) {
		parts.push(`producer tags ${target.producerTagsAll.join(", ")}`);
	}
	if ("productTagsAny" in target && target.productTagsAny?.length) {
		parts.push(`product tag any ${target.productTagsAny.join(", ")}`);
	}
	if ("productTagsAll" in target && target.productTagsAll?.length) {
		parts.push(`product tags ${target.productTagsAll.join(", ")}`);
	}
	if ("itemIds" in target && target.itemIds?.length) {
		parts.push(`items ${target.itemIds.map((id) => configItemNameFallback(id)).join(", ")}`);
	}
	if ("itemTagsAny" in target && target.itemTagsAny?.length) {
		parts.push(`item tag any ${target.itemTagsAny.join(", ")}`);
	}
	if ("itemTagsAll" in target && target.itemTagsAll?.length) {
		parts.push(`item tags ${target.itemTagsAll.join(", ")}`);
	}
	return parts.join(" · ") || "targeted";
};

const configItemNameFallback = (itemId: string) =>
	itemId.replace(/^item:/, "").replace(/^producer:/, "");

const readEffectOperationSummary = (
	operation: GameConfig["effects"][string]["operations"][number],
) => {
	const target = readEffectTargetSummary(operation.target);
	if (operation.kind === "line.reveal") return `Reveal product lines for ${target}`;
	if (operation.kind === "line.hide") return `Hide product lines for ${target}`;
	if (operation.kind === "line.blockStart") return `Block product start for ${target}`;
	if (operation.kind === "duration.addMs")
		return `Add ${operation.valueMs} ms duration to ${target}`;
	if (operation.kind === "duration.multiply") {
		return `Multiply duration by ${operation.multiplier} for ${target}`;
	}
	if (operation.kind === "loot.appendTable")
		return `Append loot table ${operation.lootTableId} to ${target}`;
	if (operation.kind === "loot.replaceTable")
		return `Replace loot table with ${operation.lootTableId} for ${target}`;
	if (operation.kind === "loot.addChanceItem")
		return `Add chance item ${operation.itemId} to ${target}`;
	if (operation.kind === "loot.dropChance.add")
		return `Adjust drop chance by ${operation.delta} for ${target}`;
	return `Block item creation for ${target}`;
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
					summary: readEffectOperationSummary(operation),
				})),
				radius: effect.scope === "local" ? effect.radius : undefined,
				scope: effect.scope,
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
		canProduce: Boolean(item.producerId || item.stashId),
		producerTrigger: item.producerId || item.stashId ? "click" : undefined,
		canMerge: isMergeableItem({
			config,
			itemId,
		}),
		generatedEffects: readGeneratedEffects({
			config,
			itemId,
		}),
		mergeResults: readMergeResults({
			config,
			itemId,
		}),
		usedInCrafts: readUsedInCrafts({
			config,
			itemId,
		}),
		usedInMerges: readUsedInMerges({
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
