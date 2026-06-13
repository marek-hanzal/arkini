import { Effect } from "effect";
import { createInitialBoardState, readBoardState } from "~/board/logic/boardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { cloneInventory, planInventoryPlacement } from "~/inventory/logic/planning";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { applyInventoryPlacementPlanFx } from "~/play/fx/applyInventoryPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { WithdrawProducerInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { json } from "~/shared/json";

export namespace withdrawInputFx {
	export interface Props {
		boardItemId: string;
		itemId: string;
	}
}

export const withdrawInputFx = Effect.fn("withdrawInputFx")(function* (
	props: withdrawInputFx.Props,
) {
	const input = yield* Effect.try({
		try: () => WithdrawProducerInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const mutable = yield* readMutableSaveFx();
			const row = mutable.boardRows.find((row) => row.id === input.boardItemId);
			if (!row) return yield* Effect.fail(new GameActionError("Producer does not exist."));
			const producer = gameConfig.getProducer(row.itemDefinitionId);
			if (!producer)
				return yield* Effect.fail(new GameActionError("This is not a producer."));

			const state = {
				...createInitialBoardState(row.itemDefinitionId, gameConfig),
				...readBoardState(row),
			};
			const producerState = state.producer ?? {};
			const inventory = {
				...(producerState.inventory ?? {}),
			};
			const stored = inventory[input.itemId] ?? 0;
			if (stored <= 0)
				return yield* Effect.fail(new GameActionError("Producer input is empty."));

			const virtualInventory = cloneInventory(mutable.inventoryRows);
			const plan = planInventoryPlacement(mutable.save, virtualInventory, input.itemId, {
				gameConfig,
				id,
			});
			if (!plan) return yield* Effect.fail(new GameActionError("Inventory is full."));

			inventory[input.itemId] = stored - 1;
			if (inventory[input.itemId] <= 0) delete inventory[input.itemId];

			yield* applyInventoryPlacementPlanFx({
				plan,
			});
			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						stateJson: json({
							...state,
							producer: {
								...producerState,
								inventory,
							},
						}),
						updatedAt: date.timestamp(),
					})
					.where("id", "=", row.id)
					.execute(),
			);
		}),
	);
});
