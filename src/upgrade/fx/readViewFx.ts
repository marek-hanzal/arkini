import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { UpgradeListView, UpgradeView } from "~/play/logic/playTypes";
import { defaultSaveGameId } from "~/play/logic/save";
import { describeUpgradeEffect } from "~/upgrade/logic/describeUpgradeEffect";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	const [upgradeRows, playerInventoryRows] = yield* dbFx((db) =>
		Promise.all([
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
			db
				.selectFrom(table.playerInventoryStack)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		]),
	);
	const levelByUpgradeId = new Map(
		upgradeRows.map((row) => [
			row.upgradeDefinitionId,
			row.level,
		]),
	);
	const availableByItemId = new Map<string, number>();
	for (const row of playerInventoryRows) {
		availableByItemId.set(
			row.itemDefinitionId,
			(availableByItemId.get(row.itemDefinitionId) ?? 0) + row.quantity,
		);
	}

	const upgrades = gameConfig.config.upgrades
		.slice()
		.sort((left, right) => left.sort - right.sort)
		.map((upgrade): UpgradeView => {
			const level = levelByUpgradeId.get(upgrade.id) ?? 0;
			const nextTier = upgrade.tiers[level];
			const nextCost = (nextTier?.cost ?? []).map((entry) => ({
				itemId: entry.itemId,
				quantity: entry.quantity,
				available: availableByItemId.get(entry.itemId) ?? 0,
			}));
			const canBuy =
				Boolean(nextTier) && nextCost.every((entry) => entry.available >= entry.quantity);

			return {
				id: upgrade.id,
				code: upgrade.code,
				name: upgrade.name,
				description: upgrade.description,
				level,
				maxLevel: upgrade.tiers.length,
				maxed: level >= upgrade.tiers.length,
				canBuy,
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

	return {
		upgrades,
	} satisfies UpgradeListView;
});
