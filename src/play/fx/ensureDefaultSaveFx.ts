import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/boardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { emptyInventoryStateJson } from "~/inventory/logic/inventoryState";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { StartingBoardItem } from "~/play/logic/StartingBoardItem";
import { defaultSaveGameId } from "~/play/logic/save";
import { json } from "~/shared/json";
import { dropDefaultSaveFx } from "./dropDefaultSaveFx";

export namespace ensureDefaultSaveFx {
	export interface Props {
		resetExisting?: boolean;
	}
}

export const ensureDefaultSaveFx = Effect.fn("ensureDefaultSaveFx")(function* ({
	resetExisting = false,
}: ensureDefaultSaveFx.Props = {}) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const timestamp = date.timestamp();

	if (resetExisting) yield* dropDefaultSaveFx();

	const existing = yield* dbFx((db) =>
		db
			.selectFrom(table.saveGame)
			.select("id")
			.where("id", "=", defaultSaveGameId)
			.executeTakeFirst(),
	);
	if (existing) return;

	yield* withTransactionFx(
		Effect.gen(function* () {
			yield* dbFx((db) =>
				db
					.insertInto(table.saveGame)
					.values({
						id: defaultSaveGameId,
						name: "Default save",
						boardWidth: gameConfig.config.game.board.width,
						boardHeight: gameConfig.config.game.board.height,
						inventorySlots: gameConfig.config.game.inventory.slots,
					})
					.execute(),
			);

			for (const [slotIndex, stack] of gameConfig.config.startingState.inventory.entries()) {
				yield* dbFx((db) =>
					db
						.insertInto(table.inventoryStack)
						.values({
							id: `${defaultSaveGameId}:inventory:${slotIndex}`,
							saveGameId: defaultSaveGameId,
							slotIndex,
							itemDefinitionId: stack.itemId,
							quantity: stack.quantity,
							stateJson: emptyInventoryStateJson,
						})
						.execute(),
				);
			}

			for (const [index, boardItem] of (
				gameConfig.config.startingState.board as readonly StartingBoardItem[]
			).entries()) {
				yield* dbFx((db) =>
					db
						.insertInto(table.boardItem)
						.values({
							id: `${defaultSaveGameId}:board:${index}`,
							saveGameId: defaultSaveGameId,
							itemDefinitionId: boardItem.itemId,
							x: boardItem.x,
							y: boardItem.y,
							stateJson: json(createInitialBoardState(boardItem.itemId, gameConfig)),
						})
						.execute(),
				);
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.saveGame)
					.set({
						updatedAt: timestamp,
					})
					.where("id", "=", defaultSaveGameId)
					.execute(),
			);
		}),
	);
});
