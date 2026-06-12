import { P, match } from "ts-pattern";
import { createInitialBoardState } from "~/board/logic/boardState";
import { localTimestamp } from "~/play/logic/localTimestamp";
import { json } from "~/shared/json";
import { table } from "~/database/local/tables";
import type { ArkiniTransaction } from "~/database/local/db";
import type { ProducerMode } from "~/manifest/data/producer";
import type { ProducerDepletion } from "~/play/logic/playTypes";
import type { BoardRow } from "~/inventory/logic/planning";

export async function depleteProducer(tx: ArkiniTransaction, row: BoardRow, mode: ProducerMode): Promise<ProducerDepletion | null> {
  return match(mode)
    .with({ type: "finite", onDepleted: "remove" }, async () => {
      await tx.deleteFrom(table.boardItem).where("id", "=", row.id).execute();
      return { kind: "remove" } satisfies ProducerDepletion;
    })
    .with({ type: "finite", onDepleted: { replaceWithItemId: P.string } }, async ({ onDepleted }) => {
      await tx
        .updateTable(table.boardItem)
        .set({
          itemDefinitionId: onDepleted.replaceWithItemId,
          stateJson: json(createInitialBoardState(onDepleted.replaceWithItemId)),
          updatedAt: localTimestamp(),
        })
        .where("id", "=", row.id)
        .execute();
      return { kind: "replace", itemId: onDepleted.replaceWithItemId } satisfies ProducerDepletion;
    })
    .otherwise(async () => null);
}
