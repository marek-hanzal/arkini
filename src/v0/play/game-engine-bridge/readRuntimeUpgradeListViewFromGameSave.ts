import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { UpgradeCostView } from "~/v0/upgrade/view/UpgradeCostViewSchema";
import type { UpgradeListView } from "~/v0/upgrade/view/UpgradeListViewSchema";
import type { UpgradeView } from "~/v0/upgrade/view/UpgradeViewSchema";

export namespace readRuntimeUpgradeListViewFromGameSave {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const inventoryQuantityByItemId = (save: GameSave) => {
	const available = new Map<string, number>();
	for (const slot of save.inventory.slots) {
		if (!slot) continue;
		available.set(
			slot.itemId,
			(available.get(slot.itemId) ?? 0) + readGameSaveInventorySlotQuantity(slot),
		);
	}
	return available;
};

const describeRuntimeUpgradeEffect = ({
	config,
	effect,
}: {
	config: GameConfig;
	effect: GameConfig["upgrades"][string]["tiers"][number]["effects"][number];
}) => {
	if (effect.type === "product.duration.add") {
		const product = config.products[effect.productId];
		const seconds = Math.abs(effect.ms) / 1000;
		return `${product?.name ?? effect.productId}: ${effect.ms < 0 ? "-" : "+"}${seconds.toFixed(1)}s duration`;
	}

	if (effect.type === "product.outputTable.set") {
		const product = config.products[effect.productId];
		const table = config.lootTables[effect.tableId];
		return `${product?.name ?? effect.productId}: ${table?.name ?? effect.tableId}`;
	}

	if (effect.type === "producer.maxQueueSize.add") {
		const producer = config.producers[effect.producerId];
		const sign = effect.quantity < 0 ? "-" : "+";
		return `${effect.producerId}: ${sign}${Math.abs(effect.quantity)} queue slot${Math.abs(effect.quantity) === 1 ? "" : "s"}${producer ? "" : " (missing producer)"}`;
	}

	if (effect.type === "product.inputRef.set") {
		const product = config.products[effect.productId];
		const input = config.inputs[effect.inputRefId];
		return `${product?.name ?? effect.productId}: input ${input?.name ?? effect.inputRefId}`;
	}

	if (effect.type === "product.requirementIds.set") {
		const product = config.products[effect.productId];
		return `${product?.name ?? effect.productId}: ${describeRequirementIds(effect.requirementIds)}`;
	}

	if (effect.type === "producer.requirementIds.set") {
		return `${effect.producerId}: ${describeRequirementIds(effect.requirementIds)}`;
	}

	const product = config.products[effect.productId];
	const item = config.items[effect.itemId];
	const sign = effect.quantity < 0 ? "-" : "+";
	return `${product?.name ?? effect.productId}: ${sign}${Math.abs(effect.quantity)} ${item?.name ?? effect.itemId}`;
};

const describeRequirementIds = (requirementIds: readonly string[]) =>
	requirementIds.length ? `requirements ${requirementIds.length}` : "requirements removed";

export const readRuntimeUpgradeListViewFromGameSave = ({
	config,
	nowMs,
	save,
}: readRuntimeUpgradeListViewFromGameSave.Props): UpgradeListView => {
	const available = inventoryQuantityByItemId(save);

	const upgrades = Object.entries(config.upgrades)
		.sort(
			([, left], [, right]) => left.sort - right.sort || left.name.localeCompare(right.name),
		)
		.map(([upgradeId, upgrade]): UpgradeView => {
			const completed = save.upgrades[upgradeId]?.completedTiers ?? 0;
			const runningJob = Object.values(save.upgradeJobs).find(
				(job) => job.upgradeId === upgradeId,
			);
			const tierIndex = runningJob?.tierIndex ?? completed;
			const nextTier = upgrade.tiers[tierIndex];
			const inProgress = Boolean(runningJob);
			const startedAtMs = runningJob?.startedAtMs;
			const readyAtMs = runningJob?.completesAtMs;
			const progress =
				startedAtMs !== undefined && readyAtMs !== undefined
					? Math.max(
							0,
							Math.min(
								1,
								(nowMs - startedAtMs) / Math.max(1, readyAtMs - startedAtMs),
							),
						)
					: undefined;
			const nextCost: UpgradeCostView[] = (nextTier?.cost ?? []).map((cost) => ({
				available: available.get(cost.itemId) ?? 0,
				itemId: cost.itemId as UpgradeCostView["itemId"],
				quantity: cost.quantity,
			}));
			const canAfford = nextCost.every((cost) => cost.available >= cost.quantity);

			return {
				canBuy: Boolean(nextTier) && canAfford && !inProgress,
				code: upgrade.code,
				currentEffects: upgrade.tiers.slice(0, completed).flatMap((tier) =>
					tier.effects.map((effect) =>
						describeRuntimeUpgradeEffect({
							config,
							effect,
						}),
					),
				),
				description: upgrade.description,
				id: upgradeId as UpgradeView["id"],
				inProgress,
				level: completed,
				maxLevel: upgrade.tiers.length,
				maxed: completed >= upgrade.tiers.length,
				name: upgrade.name,
				nextCost,
				nextEffects:
					nextTier?.effects.map((effect) =>
						describeRuntimeUpgradeEffect({
							config,
							effect,
						}),
					) ?? [],
				progress,
				readyAtMs,
				startedAtMs,
			};
		});

	return {
		upgrades,
	};
};
