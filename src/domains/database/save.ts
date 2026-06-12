import { gameDataManifest } from "~/domains/game-data";
import { createInitialBoardState } from "./boardState";
import { json } from "./utils/json";
import { db } from "./db";
import { table } from "./tables";

export const defaultSaveGameId = "save:default";

type StartingBoardItem = { itemId: string; x: number; y: number };

export async function ensureDefaultSaveGame() {
  const existing = await db.selectFrom(table.saveGame).select("id").where("id", "=", defaultSaveGameId).executeTakeFirst();
  if (existing) {
    await syncDefaultSaveShape();
    return;
  }

  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto(table.saveGame)
      .values({
        id: defaultSaveGameId,
        name: "Default save",
        boardWidth: gameDataManifest.game.board.width,
        boardHeight: gameDataManifest.game.board.height,
        inventorySlots: gameDataManifest.game.inventory.slots,
      })
      .execute();

    for (const [slotIndex, stack] of gameDataManifest.startingState.inventory.entries()) {
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

    for (const [index, boardItem] of (gameDataManifest.startingState.board as readonly StartingBoardItem[]).entries()) {
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

    await tx.updateTable(table.saveGame).set({ updatedAt: new Date().toISOString() }).where("id", "=", defaultSaveGameId).execute();
  });
}

async function syncDefaultSaveShape() {
  const inventorySlots = gameDataManifest.game.inventory.slots;

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable(table.saveGame)
      .set({
        boardWidth: gameDataManifest.game.board.width,
        boardHeight: gameDataManifest.game.board.height,
        inventorySlots,
        updatedAt: new Date().toISOString(),
      })
      .where("id", "=", defaultSaveGameId)
      .execute();

    await tx
      .deleteFrom(table.inventoryStack)
      .where("saveGameId", "=", defaultSaveGameId)
      .where("slotIndex", ">=", inventorySlots)
      .execute();
  });
}
