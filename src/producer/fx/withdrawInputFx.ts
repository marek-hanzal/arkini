import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { readBoardState } from "~/board/logic/readBoardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { applyInventoryPlacementPlanFx } from "~/play/fx/applyInventoryPlacementPlanFx";
import { WithdrawProducerInputSchema } from "~/play/schema/WithdrawProducerInputSchema";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { planInventoryPlacement } from "~/inventory/logic/planning/planInventoryPlacement";
import { normalizeInventoryStateJson } from "~/inventory/logic/normalizeInventoryStateJson";
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

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const updatedAt = date.timestamp();
			const mutable = yield* readMutableSaveFx();
			const row = mutable.boardRows.find((entry) => entry.id === input.boardItemId);
			if (!row) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const activation = gameConfig.getActivation(row.itemDefinitionId);
			if (!activation) {
				return yield* Effect.fail(new GameActionError("This item cannot store inputs."));
			}

			const state = readBoardState(row);
			const activationState = {
				...(createInitialBoardState(row.itemDefinitionId, gameConfig).activation ?? {}),
				...(state.activation ?? {}),
			};
			const inventory = {
				...(activationState.inventory ?? {}),
			};
			const stored = inventory[input.itemId] ?? 0;
			if (stored <= 0) {
				return yield* Effect.fail(new GameActionError("No stored input to withdraw."));
			}
			inventory[input.itemId] = stored - 1;
			if (inventory[input.itemId] <= 0) delete inventory[input.itemId];

			const plan = planInventoryPlacement(mutable.save, mutable.inventoryRows, input.itemId, {
				gameConfig,
				id,
				stateJson: normalizeInventoryStateJson("{}"),
			});
			if (!plan) {
				return yield* Effect.fail(new GameActionError("Inventory is full."));
			}

			yield* applyInventoryPlacementPlanFx({
				plan,
			});
			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						stateJson: json({
							...state,
							activation: {
								...activationState,
								inventory,
							},
						}),
						updatedAt,
					})
					.where("id", "=", row.id)
					.execute(),
			);
		}),
	);
});
