import { Effect } from "effect";
import { completeReadyFx } from "~/upgrade/fx/completeReadyFx";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { readInventoryStackRowsFx } from "~/item-instance/fx/readInventoryStackRowsFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { isEmptyInventoryStateJson } from "~/inventory/logic/isEmptyInventoryStateJson";
import { canSpendInventoryItems } from "~/inventory/logic/planning/canSpendInventoryItems";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { UpgradeListViewSchema, type UpgradeListView } from "~/upgrade/view/UpgradeListViewSchema";
import type { UpgradeView } from "~/upgrade/view/UpgradeViewSchema";
import { defaultSaveGameId } from "~/play/logic/save";
import { describeUpgradeEffect } from "~/upgrade/logic/describeUpgradeEffect";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	yield* completeReadyFx();

	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const [upgradeRows, inventoryRows] = yield* Effect.all([
		dbFx((db) =>
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		),
		readInventoryStackRowsFx(),
	]);
	const availableByItemId = new Map<string, number>();
	for (const row of inventoryRows) {
		if (!isEmptyInventoryStateJson(row.stateJson)) continue;
		availableByItemId.set(
			row.itemDefinitionId,
			(availableByItemId.get(row.itemDefinitionId) ?? 0) + row.quantity,
		);
	}

	const upgrades = gameConfig.config.upgrades
		.slice()
		.sort((left, right) => left.sort - right.sort)
		.map((upgrade): UpgradeView => {
			const row = upgradeRows.find((row) => row.upgradeDefinitionId === upgrade.id);
			const level = row?.level ?? 0;
			const nextTier = upgrade.tiers[level];
			const startedAtMs = row?.startedAt ? date.parseTimestampMs(row.startedAt) : undefined;
			const readyAtMs = row?.readyAt ? date.parseTimestampMs(row.readyAt) : undefined;
			const nowMs = date.now().toMillis();
			const inProgress = row?.targetLevel !== null && row?.targetLevel !== undefined;
			const progress =
				inProgress && startedAtMs !== undefined && readyAtMs !== undefined
					? Math.max(
							0,
							Math.min(
								1,
								(nowMs - startedAtMs) / Math.max(1, readyAtMs - startedAtMs),
							),
						)
					: undefined;
			const nextCost = (nextTier?.cost ?? []).map((entry) => ({
				itemId: entry.itemId,
				quantity: entry.quantity,
				available: availableByItemId.get(entry.itemId) ?? 0,
			}));
			const canBuy =
				Boolean(nextTier) && canSpendInventoryItems(inventoryRows, nextTier.cost);

			return {
				id: upgrade.id,
				code: upgrade.code,
				name: upgrade.name,
				description: upgrade.description,
				level,
				maxLevel: upgrade.tiers.length,
				maxed: level >= upgrade.tiers.length,
				inProgress,
				canBuy: canBuy && !inProgress,
				startedAtMs,
				readyAtMs,
				progress,
				nextCost,
				currentEffects: upgrade.tiers
					.slice(0, level)
					.flatMap((tier) =>
						tier.effects.map((effect) => describeUpgradeEffect(gameConfig, effect)),
					),
				nextEffects:
					nextTier?.effects.map((effect) => describeUpgradeEffect(gameConfig, effect)) ??
					[],
			};
		});

	return UpgradeListViewSchema.parse({
		upgrades,
	}) satisfies UpgradeListView;
});
