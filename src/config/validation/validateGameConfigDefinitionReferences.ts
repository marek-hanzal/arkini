import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import {
	addIssue,
	type GameConfigValidationContext,
	validateUniqueStringList,
} from "~/config/validation/GameConfigValidationCommon";
import { validateActivationOutput } from "~/config/validation/validateGameConfigActivationOutput";
import {
	validateCraftCapability,
	validateProducerCapability,
} from "~/config/validation/validateGameConfigCapabilities";

export const validateConfigDefinitionReferences = ({
	config: value,
	ctx,
	grantIds,
	hasAsset,
	hasItem,
	hasResource,
	itemIds,
}: GameConfigValidationContext) => {
	validateAssetDefinitionReferences({
		ctx,
		hasAsset,
		hasResource,
		value,
	});
	validateItemDefinitionReferences({
		ctx,
		grantIds,
		hasItem,
		itemIds,
		value,
	});
};

const validateAssetDefinitionReferences = ({
	ctx,
	hasAsset,
	hasResource,
	value,
}: {
	ctx: z.RefinementCtx;
	hasAsset: (assetId: string) => boolean;
	hasResource: (resourceId: string) => boolean;
	value: GameConfig;
}) => {
	for (const [assetId, asset] of Object.entries(value.assets)) {
		if (!hasResource(asset.resourceId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"resourceId",
				],
				`Missing resource "${asset.resourceId}".`,
			);
		}
		if (asset.overlayAssetId && !hasAsset(asset.overlayAssetId)) {
			addIssue(
				ctx,
				[
					"assets",
					assetId,
					"overlayAssetId",
				],
				`Missing overlay asset "${asset.overlayAssetId}".`,
			);
		}
	}
};

const validateItemDefinitionReferences = ({
	ctx,
	grantIds,
	hasItem,
	itemIds,
	value,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	itemIds: readonly string[];
	value: GameConfig;
}) => {
	for (const [itemId, item] of Object.entries(value.items)) {
		validateItemAssetReferences({
			ctx,
			item,
			itemId,
			value,
		});
		validateItemOwnDefinition({
			ctx,
			hasItem,
			item,
			itemId,
		});
		validateItemMergeReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
		});
		validateItemRemovalReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
		});
		validateItemCapabilityReferences({
			ctx,
			grantIds,
			hasItem,
			item,
			itemId,
			itemIds,
			value,
		});
	}
};

type ConfigItem = GameConfig["items"][string];

const validateItemAssetReferences = ({
	ctx,
	item,
	itemId,
	value,
}: {
	ctx: z.RefinementCtx;
	item: ConfigItem;
	itemId: string;
	value: GameConfig;
}) => {
	for (const [assetIndex, assetId] of item.assetIds.entries()) {
		if (value.assets[assetId]) continue;
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"assetIds",
				assetIndex,
			],
			`Missing asset "${assetId}".`,
		);
	}
};

const validateItemOwnDefinition = ({
	ctx,
	hasItem,
	item,
	itemId,
}: {
	ctx: z.RefinementCtx;
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
}) => {
	validateUniqueStringList(
		ctx,
		[
			"items",
			itemId,
			"tags",
		],
		item.tags,
		(value) => `Duplicate tag "${value}".`,
	);

	if (item.capacity?.onDepleted === "replace" && !hasItem(item.capacity.replaceItemId)) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"capacity",
				"replaceItemId",
			],
			`Missing item "${item.capacity.replaceItemId}".`,
		);
	}
	if (item.capacity && item.maxStackSize !== 1) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
				"maxStackSize",
			],
			`Item "${itemId}" has capacity and must use maxStackSize 1 to preserve per-instance state.`,
		);
	}
};

const validateItemMergeReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
	itemIds: readonly string[];
}) => {
	for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
		if (!hasItem(merge.withItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"withItemId",
				],
				`Missing item "${merge.withItemId}".`,
			);
		}
		if ("resultItemId" in merge && !hasItem(merge.resultItemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"resultItemId",
				],
				`Missing item "${merge.resultItemId}".`,
			);
		}
		if (merge.output) {
			validateActivationOutput(
				ctx,
				[
					"items",
					itemId,
					"merges",
					mergeIndex,
					"output",
				],
				merge.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}
	}
};

const validateItemRemovalReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
	itemIds: readonly string[];
}) => {
	for (const [index, removal] of (item.removeBy ?? []).entries()) {
		if (!hasItem(removal.itemId)) {
			addIssue(
				ctx,
				[
					"items",
					itemId,
					"removeBy",
					index,
					"itemId",
				],
				`Missing item "${removal.itemId}".`,
			);
		}
		if (removal.output) {
			validateActivationOutput(
				ctx,
				[
					"items",
					itemId,
					"removeBy",
					index,
					"output",
				],
				removal.output,
				{
					grantIds,
					hasItem,
					itemIds,
				},
			);
		}
	}
};

const validateItemCapabilityReferences = ({
	ctx,
	grantIds,
	hasItem,
	item,
	itemId,
	itemIds,
	value,
}: {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	item: ConfigItem;
	itemId: string;
	itemIds: readonly string[];
	value: GameConfig;
}) => {
	if (item.producer && item.stash) {
		addIssue(
			ctx,
			[
				"items",
				itemId,
			],
			`Item "${itemId}" must not define both producer and stash capabilities.`,
		);
	}

	if (item.producer) {
		validateProducerCapability({
			capability: item.producer,
			capabilityId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			section: "producer",
		});
	}
	if (item.stash) {
		validateProducerCapability({
			capability: item.stash,
			capabilityId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			section: "stash",
		});
	}
	if (item.craft) {
		validateCraftCapability({
			craftItemId: itemId,
			ctx,
			grantIds,
			hasItem,
			itemIds,
			recipe: item.craft,
			value,
		});
	}
};
