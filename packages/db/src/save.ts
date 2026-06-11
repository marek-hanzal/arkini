import { gameDataManifest } from "@arkini/game-data";
import { kysely } from "./client";

export const defaultSaveGameId = "save:default";

// Definitions are forcibly synced every boot; player progress is not. This only
// creates the first save once, then leaves future gameplay state alone like a
// civilized little database.
type StartingBoardItem = { itemId: string; x: number; y: number };

export async function ensureDefaultSaveGame() {
  const existing = await kysely
    .selectFrom("saveGame")
    .select("id")
    .where("id", "=", defaultSaveGameId)
    .executeTakeFirst();

  if (existing) {
    return;
  }

  await kysely.transaction().execute(async (tx) => {
    await tx
      .insertInto("saveGame")
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
        .insertInto("inventoryStack")
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
        .insertInto("boardItem")
        .values({
          id: `${defaultSaveGameId}:board:${index}`,
          saveGameId: defaultSaveGameId,
          itemDefinitionId: boardItem.itemId,
          x: boardItem.x,
          y: boardItem.y,
          stateJson: "{}",
        })
        .execute();
    }

    await tx
      .updateTable("saveGame")
      .set({ updatedAt: new Date().toISOString() })
      .where("id", "=", defaultSaveGameId)
      .execute();
  });
}
