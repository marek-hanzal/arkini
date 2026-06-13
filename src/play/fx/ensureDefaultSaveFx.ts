import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/boardState";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { GameConfig } from "~/manifest/data/GameConfig";
import { json } from "~/shared/json";
import type { StartingBoardItem } from "~/play/logic/StartingBoardItem";
import { defaultSaveGameId } from "~/play/logic/save";
import { dropDefaultSaveFx } from "./dropDefaultSaveFx";
import { tryGameAction } from "../logic/tryGameAction";

export namespace ensureDefaultSaveFx {
	export interface Props {
		resetExisting?: boolean;
	}
}

export const ensureDefaultSaveFx = Effect.fn("ensureDefaultSaveFx")(function* ({
	resetExisting = false,
}: ensureDefaultSaveFx.Props = {}) {
	if (resetExisting) yield* dropDefaultSaveFx();

	const existing = yield* tryGameAction(() =>
		db
			.selectFrom(table.saveGame)
			.select("id")
			.where("id", "=", defaultSaveGameId)
			.executeTakeFirst(),
	);
	if (existing) return;

	yield* tryGameAction(() =>
		db.transaction().execute(async (tx) => {
			await tx
				.insertInto(table.saveGame)
				.values({
					id: defaultSaveGameId,
					name: "Default save",
					boardWidth: GameConfig.game.board.width,
					boardHeight: GameConfig.game.board.height,
					inventorySlots: GameConfig.game.inventory.slots,
				})
				.execute();

			for (const resource of GameConfig.startingState.resources) {
				await tx
					.insertInto(table.playerResource)
					.values({
						id: `${defaultSaveGameId}:resource:${resource.resourceId}`,
						saveGameId: defaultSaveGameId,
						resourceDefinitionId: resource.resourceId,
						quantity: resource.quantity,
					})
					.execute();
			}

			for (const [slotIndex, stack] of GameConfig.startingState.inventory.entries()) {
				await tx
					.insertInto(table.inventoryStack)
					.values({
						id: `${defaultSaveGameId}:inventory:${slotIndex}`,
						saveGameId: defaultSaveGameId,
						slotIndex,
						itemDefinitionId: stack.itemId,
						quantity: stack.quantity,
					})
					.execute();
			}

			for (const [index, boardItem] of (
				GameConfig.startingState.board as readonly StartingBoardItem[]
			).entries()) {
				await tx
					.insertInto(table.boardItem)
					.values({
						id: `${defaultSaveGameId}:board:${index}`,
						saveGameId: defaultSaveGameId,
						itemDefinitionId: boardItem.itemId,
						x: boardItem.x,
						y: boardItem.y,
						stateJson: json(createInitialBoardState(boardItem.itemId)),
					})
					.execute();
			}

			await tx
				.updateTable(table.saveGame)
				.set({
					updatedAt: new Date().toISOString(),
				})
				.where("id", "=", defaultSaveGameId)
				.execute();
		}),
	);
});
