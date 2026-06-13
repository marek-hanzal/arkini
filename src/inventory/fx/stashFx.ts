import { Effect } from "effect";
import { readBoardState } from "~/board/logic/boardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import {
	cloneInventory,
	planExactInventorySlotPlacement,
	planInventoryPlacement,
} from "~/inventory/logic/planning";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { applyInventoryPlacementPlanFx } from "~/play/fx/applyInventoryPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { StashBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

export namespace stashFx {
	export interface Props {
		boardItemId: string;
		slotIndex?: number;
	}
}

export const stashFx = Effect.fn("stashFx")(function* (props: stashFx.Props) {
	const input = yield* Effect.try({
		try: () => StashBoardItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			const boardItem = boardRows.find((row) => row.id === input.boardItemId);
			if (!boardItem) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}
			if (gameConfig.isProducer(boardItem.itemDefinitionId)) {
				const state = readBoardState(boardItem);
				const cooldownUntil = state.producer?.cooldownUntil;
				if (
					cooldownUntil &&
					(date.parseTimestampMs(cooldownUntil) ?? 0) > date.now().toMillis()
				) {
					return yield* Effect.fail(new GameActionError("Producer is busy."));
				}
				const storedInputs = Object.values(state.producer?.inventory ?? {}).reduce(
					(sum, quantity) => sum + quantity,
					0,
				);
				if (storedInputs > 0) {
					return yield* Effect.fail(
						new GameActionError("Empty producer inputs before stashing."),
					);
				}
			}

			const options = {
				gameConfig,
				id,
			};
			const virtualInventory = cloneInventory(inventoryRows);
			const plan =
				input.slotIndex === undefined
					? planInventoryPlacement(
							save,
							virtualInventory,
							boardItem.itemDefinitionId,
							options,
						)
					: planExactInventorySlotPlacement(
							save,
							virtualInventory,
							boardItem.itemDefinitionId,
							input.slotIndex,
							options,
						);
			if (!plan) {
				return yield* Effect.fail(
					new GameActionError(
						input.slotIndex === undefined
							? "Inventory is full."
							: "Inventory slot cannot accept this item.",
					),
				);
			}

			yield* applyInventoryPlacementPlanFx({
				plan,
			});
			yield* dbFx((db) =>
				db.deleteFrom(table.boardItem).where("id", "=", boardItem.id).execute(),
			);
		}),
	);
});
