import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { spendInventoryItems } from "~/inventory/logic/planning";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { BuyUpgradeInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

export namespace buyFx {
	export interface Props {
		upgradeId: string;
	}
}

export const buyFx = Effect.fn("buyFx")(function* (props: buyFx.Props) {
	const input = yield* Effect.try({
		try: () => BuyUpgradeInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* withTransactionFx(
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

			for (const step of spendPlan) {
				if (step.type === "delete") {
					yield* dbFx((db) =>
						db
							.deleteFrom(table.inventoryStack)
							.where("id", "=", step.stackId)
							.execute(),
					);
					continue;
				}
				yield* dbFx((db) =>
					db
						.updateTable(table.inventoryStack)
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
						.updateTable(table.playerUpgrade)
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
						.insertInto(table.playerUpgrade)
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
		}),
	);
});
