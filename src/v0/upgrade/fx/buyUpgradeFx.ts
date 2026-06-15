import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { IdServiceFx } from "~/v0/id/context/IdServiceFx";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { spendInventoryItems } from "~/v0/inventory/logic/planning/spendInventoryItems";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { BuyUpgradeInputSchema } from "~/v0/upgrade/schema/BuyUpgradeInputSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";

export namespace buyUpgradeFx {
	export interface Props {
		upgradeId: string;
	}
}

export const buyUpgradeFx = Effect.fn("buyUpgradeFx")(function* (props: buyUpgradeFx.Props) {
	const input = yield* Effect.tryPromise({
		try: () => BuyUpgradeInputSchema.parseAsync(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const id = yield* IdServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const timestamp = date.timestamp();
			const upgrade = gameConfig.getUpgrade(input.upgradeId);
			if (!upgrade) return yield* Effect.fail(new GameActionError("Unknown upgrade."));
			const mutable = yield* readMutableSaveFx();
			const existing = mutable.upgradeRows.find(
				(row) => row.upgradeDefinitionId === upgrade.id,
			);
			const level = existing?.level ?? 0;
			if (existing?.targetLevel !== null && existing?.targetLevel !== undefined) {
				return yield* Effect.fail(new GameActionError("Upgrade is already in progress."));
			}
			const nextTier = upgrade.tiers[level];
			if (!nextTier) return yield* Effect.fail(new GameActionError("Upgrade is maxed."));

			const spendPlan = spendInventoryItems(
				[
					...mutable.inventoryRows,
				],
				nextTier.cost,
			);
			if (!spendPlan) return yield* Effect.fail(new GameActionError("Missing upgrade cost."));
			const inventoryRowsById = new Map(
				mutable.inventoryRows.map((row) => [
					row.id,
					row,
				]),
			);

			for (const step of spendPlan) {
				if (step.type === "delete") {
					yield* dbFx((db) =>
						db.deleteFrom("itemInstance").where("id", "=", step.stackId).execute(),
					);
					continue;
				}
				yield* dbFx((db) =>
					db
						.updateTable("itemInstance")
						.set({
							quantity: step.quantity,
							updatedAt: timestamp,
						})
						.where("id", "=", step.stackId)
						.execute(),
				);
			}

			const targetLevel = level + 1;
			const startedAt = timestamp;
			const readyAt = date.toTimestamp(
				date.now().plus({
					milliseconds: nextTier.durationMs,
				}),
			);

			if (existing) {
				yield* dbFx((db) =>
					db
						.updateTable("playerUpgrade")
						.set({
							targetLevel,
							startedAt,
							readyAt,
							updatedAt: timestamp,
						})
						.where("id", "=", existing.id)
						.execute(),
				);
			} else {
				yield* dbFx((db) =>
					db
						.insertInto("playerUpgrade")
						.values({
							id: id.prefixed("upgrade"),
							saveGameId: mutable.save.id,
							upgradeDefinitionId: upgrade.id,
							level,
							targetLevel,
							startedAt,
							readyAt,
						})
						.execute(),
				);
			}

			return {
				visualEvents: [
					...spendPlan.flatMap((step) => {
						const row = inventoryRowsById.get(step.stackId);
						if (!row) return [];

						return [
							{
								type: "item.consumed" as const,
								itemInstanceId: row.id,
								itemId: row.itemDefinitionId,
								from: {
									kind: "inventory" as const,
									slotIndex: row.slotIndex,
								},
								reason: "upgrade-cost" as const,
							},
						];
					}),
					{
						type: "upgrade.started",
						upgradeId: upgrade.id,
						targetLevel,
					},
				],
			} satisfies ActionResultSchema.Type;
		}),
	);
});
