import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/board/server/boardState";
import { serverTimestamp } from "~/play/server/serverTimestamp";
import { json } from "~/shared/json";
import { table } from "~/database/server/tables";
import type { ArkiniTransaction } from "~/database/server/db";
import type { ProducerMode } from "~/manifest/server/producer";
import type { BoardRow } from "~/inventory/server/planning";

export async function depleteProducer(tx: ArkiniTransaction, row: BoardRow, mode: ProducerMode) {
  await match(mode)
    .with({ type: "finite", onDepleted: "remove" }, async () => {
      await tx.deleteFrom(table.boardItem).where("id", "=", row.id).execute();
    })
    .with({ type: "finite", onDepleted: { replaceWithItemId: P.string } }, async ({ onDepleted }) => {
      await tx
        .updateTable(table.boardItem)
        .set({
          itemDefinitionId: onDepleted.replaceWithItemId,
          stateJson: json(createInitialBoardState(onDepleted.replaceWithItemId)),
          updatedAt: serverTimestamp(),
        })
        .where("id", "=", row.id)
        .execute();
    })
    .otherwise(async () => undefined);
}
