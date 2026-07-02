import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import { readBoardItemCount } from "~/v0/game/board/readBoardItemCount";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";
import { readCraftRecipeDefinition } from "~/v0/game/config/GameItemCapabilities";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import { readProducerJobLine } from "~/v0/game/producer/readProducerJobLine";

type ActivationOutput = NonNullable<GameProducerLineDefinition["output"]>;
type ActivationOutputEntry = ActivationOutput[number];

export namespace readItemTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		includePendingCraftJobs?: boolean;
		includePendingCraftSourceItems?: boolean;
		includePendingProducerJobs?: boolean;
		itemId: string;
		nowMs?: number;
		requiredQuantity?: number;
		save: GameSave;
	}
}

const appendTargetItemId = ({
	itemIds,
	itemId,
}: {
	itemIds: string[];
	itemId: string | undefined;
}) => {
	if (!itemId || itemIds.includes(itemId)) return;
	itemIds.push(itemId);
};

const readOutputQuantityMaximum = (
	quantity:
		| number
		| {
				max: number;
				min: number;
		  },
) => (typeof quantity === "number" ? quantity : quantity.max);

const readItemBoardAndInventoryQuantity = ({
	ignoredBoardItemInstanceIds,
	itemId,
	save,
}: {
	ignoredBoardItemInstanceIds: ReadonlySet<string>;
	itemId: string;
	save: GameSave;
}) => {
	let quantity = readBoardItemCount({
		ignoredBoardItemInstanceIds,
		itemId,
		save,
	});

	for (const slot of save.inventory.slots) {
		if (slot?.itemId !== itemId) continue;
		quantity += readGameSaveInventorySlotQuantity(slot);
	}

	return quantity;
};

const readItemTargetItemIds = ({ config, itemId }: { config: GameConfig; itemId: string }) => {
	const itemIds: string[] = [];
	appendTargetItemId({
		itemId,
		itemIds,
	});
	appendTargetItemId({
		itemId: readCraftRecipeDefinition({
			config,
			recipeId: itemId,
		})?.resultItemId,
		itemIds,
	});
	return itemIds;
};

const outputEntryCanCreateTargetItem = ({
	config,
	outputEntry,
	targetItemId,
}: {
	config: GameConfig;
	outputEntry: ActivationOutputEntry;
	targetItemId: string;
}) => {
	if (outputEntry.type !== "guaranteed") return false;
	return readItemTargetItemIds({
		config,
		itemId: outputEntry.itemId,
	}).includes(targetItemId);
};

const readPendingProducerOutputQuantity = ({
	config,
	nowMs,
	save,
	targetItemId,
}: {
	config: GameConfig;
	nowMs?: number;
	save: GameSave;
	targetItemId: string;
}) => {
	let quantity = 0;

	for (const job of Object.values(save.producerJobs)) {
		const line = readProducerJobLine({
			config,
			job,
			save,
		});
		if (!line?.output) continue;

		const effectiveProducerLine = readEffectiveProducerLine({
			baseDurationMs: readProducerLineDurationMs({
				line,
			}),
			config,
			nowMs,
			producerItemInstanceId: job.producerItemInstanceId,
			line,
			lineId: job.lineId,
			save,
		});

		for (const outputEntry of effectiveProducerLine.lootPlan.baseOutput) {
			if (outputEntry.type !== "guaranteed") continue;
			if (
				!outputEntryCanCreateTargetItem({
					config,
					outputEntry,
					targetItemId,
				})
			) {
				continue;
			}
			quantity += readOutputQuantityMaximum(outputEntry.quantity);
		}
	}

	return quantity;
};

const readPendingCraftJobQuantity = ({
	config,
	ignoredBoardItemInstanceIds,
	save,
	targetItemId,
}: {
	config: GameConfig;
	ignoredBoardItemInstanceIds: ReadonlySet<string>;
	save: GameSave;
	targetItemId: string;
}) => {
	let quantity = 0;

	for (const job of Object.values(save.craftJobs)) {
		if (ignoredBoardItemInstanceIds.has(job.targetItemInstanceId)) continue;
		const recipe = readCraftRecipeDefinition({
			config,
			recipeId: job.recipeId,
		});
		if (recipe?.resultItemId === targetItemId) quantity += 1;
	}

	return quantity;
};

const readPendingCraftSourceItemQuantity = ({
	config,
	ignoredBoardItemInstanceIds,
	save,
	targetItemId,
}: {
	config: GameConfig;
	ignoredBoardItemInstanceIds: ReadonlySet<string>;
	save: GameSave;
	targetItemId: string;
}) => {
	let quantity = 0;

	for (const [sourceItemId, item] of Object.entries(config.items)) {
		const recipe = item.craft;
		if (!recipe) continue;
		if (sourceItemId === targetItemId) continue;
		if (recipe.resultItemId !== targetItemId) continue;
		quantity += readItemBoardAndInventoryQuantity({
			ignoredBoardItemInstanceIds,
			itemId: sourceItemId,
			save,
		});
	}

	return quantity;
};

export const readItemTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds = new Set(),
	includePendingCraftJobs = false,
	includePendingCraftSourceItems = false,
	includePendingProducerJobs = false,
	itemId,
	nowMs,
	requiredQuantity = 1,
	save,
}: readItemTargetLimits.Props): ItemTargetLimit[] =>
	readItemTargetItemIds({
		config,
		itemId,
	}).flatMap((targetItemId) => {
		const maxCount = config.items[targetItemId]?.maxCount;
		if (maxCount === undefined) return [];

		const ownedQuantity =
			readBoardItemCount({
				ignoredBoardItemInstanceIds,
				itemId: targetItemId,
				save,
			}) +
			(includePendingCraftSourceItems
				? readPendingCraftSourceItemQuantity({
						config,
						ignoredBoardItemInstanceIds,
						save,
						targetItemId,
					})
				: 0) +
			(includePendingCraftJobs
				? readPendingCraftJobQuantity({
						config,
						ignoredBoardItemInstanceIds,
						save,
						targetItemId,
					})
				: 0) +
			(includePendingProducerJobs
				? readPendingProducerOutputQuantity({
						config,
						nowMs,
						save,
						targetItemId,
					})
				: 0);

		return [
			{
				itemId: targetItemId as ItemId,
				maxCount,
				ownedQuantity,
				remainingQuantity: Math.max(0, maxCount - ownedQuantity),
				requiredQuantity,
				...(targetItemId === itemId
					? {}
					: {
							sourceItemId: itemId as ItemId,
						}),
			},
		] satisfies ItemTargetLimit[];
	});
