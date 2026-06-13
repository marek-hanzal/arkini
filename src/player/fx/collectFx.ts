import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { applyPlacementPlanFx } from "~/player/fx/applyPlacementPlanFx";
import { planPlayerInventoryPlacement } from "~/player/logic/planning";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { CollectBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { readEffectivePlayerInventorySlots } from "~/upgrade/logic/readEffectivePlayerInventorySlots";

export namespace collectFx {
	export interface Props {
		boardItemId: string;
	}
}

export const collectFx = Effect.fn("collectFx")(function* (props: collectFx.Props) {
	const input = yield* Effect.try({
		try: () => CollectBoardItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const mutable = yield* readMutableSaveFx();
			const row = mutable.boardRows.find((row) => row.id === input.boardItemId);
			if (!row) return yield* Effect.fail(new GameActionError("Board item does not exist."));
			const item = gameConfig.getItem(row.itemDefinitionId);
			const collect = item?.collect;
			if (!item || !collect) {
				return yield* Effect.fail(new GameActionError("This item cannot be collected."));
			}

			const itemId = collect.itemId ?? row.itemDefinitionId;
			const quantity = collect.quantity ?? 1;
			const capacity = readEffectivePlayerInventorySlots(gameConfig, mutable.upgradeRows);
			const plan = planPlayerInventoryPlacement(
				[
					...mutable.playerInventoryRows,
				],
				itemId,
				quantity,
				{
					capacity,
					gameConfig,
					id,
				},
			);
			if (!plan) return yield* Effect.fail(new GameActionError("Player inventory is full."));

			yield* applyPlacementPlanFx({
				plan,
			});
			yield* dbFx((db) => db.deleteFrom(table.boardItem).where("id", "=", row.id).execute());
			yield* dbFx((db) =>
				db
					.updateTable(table.saveGame)
					.set({
						updatedAt: date.timestamp(),
					})
					.where("id", "=", mutable.save.id)
					.execute(),
			);

			return {
				itemId,
				quantity,
			};
		}),
	);
});
