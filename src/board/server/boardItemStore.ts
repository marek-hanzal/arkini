import { createInitialBoardState } from "~/board/server/boardState";
import { defaultSaveGameId } from "~/play/server/save";
import { json } from "~/shared/json";
import { table } from "~/database/server/tables";
import type { ArkiniTransaction } from "~/database/server/db";

export async function insertBoardItem(tx: ArkiniTransaction, itemId: string, x: number, y: number) {
  const id = createBoardItemId();
  await tx
    .insertInto(table.boardItem)
    .values({
      id,
      saveGameId: defaultSaveGameId,
      itemDefinitionId: itemId,
      x,
      y,
      stateJson: json(createInitialBoardState(itemId)),
    })
    .execute();
  return id;
}

function createBoardItemId() {
  return `board:${Date.now().toString(36)}:${crypto.randomUUID()}`;
}
