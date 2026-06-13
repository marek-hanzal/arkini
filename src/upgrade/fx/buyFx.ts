import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { spendPlayerInventoryItems } from "~/player/logic/planning";
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
			const nextTier = upgrade.tiers[level];
			if (!nextTier) return yield* Effect.fail(new GameActionError("Upgrade is maxed."));

			const spendPlan = spendPlayerInventoryItems(
				[
					...mutable.playerInventoryRows,
				],
				nextTier.cost,
			);
			if (!spendPlan) return yield* Effect.fail(new GameActionError("Missing upgrade cost."));

			for (const step of spendPlan) {
				if (step.type === "delete") {
					yield* dbFx((db) =>
						db
							.deleteFrom(table.playerInventoryStack)
							.where("id", "=", step.stackId)
							.execute(),
					);
					continue;
				}
				yield* dbFx((db) =>
					db
						.updateTable(table.playerInventoryStack)
						.set({
							quantity: step.quantity,
							updatedAt: timestamp,
						})
						.where("id", "=", step.stackId)
						.execute(),
				);
			}

			if (existing) {
				yield* dbFx((db) =>
					db
						.updateTable(table.playerUpgrade)
						.set({
							level: level + 1,
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
							level: 1,
						})
						.execute(),
				);
			}
		}),
	);
});
