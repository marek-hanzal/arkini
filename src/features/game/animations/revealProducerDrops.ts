import type { Dispatch, SetStateAction } from "react";
import type { ProducerDropResult } from "~/domains/database";
import { stashAnimationMs } from "~/features/game/components/constants";
import { boardCellKey } from "~/features/game/components/helpers/boardCellId";
import { cssEscape, snapshotRect, wait } from "~/features/game/components/helpers/dom";
import type { Flyout } from "~/features/game/components/types";

export async function revealProducerDrops({
  producerBoardItemId,
  result,
  invalidateGameData,
  setHiddenBoardItemIds,
  setFlyout,
  pulseBoard,
}: {
  producerBoardItemId: string;
  result: ProducerDropResult;
  invalidateGameData(): Promise<void>;
  setHiddenBoardItemIds: Dispatch<SetStateAction<Set<string>>>;
  setFlyout: Dispatch<SetStateAction<Flyout | null>>;
  pulseBoard(cellKey: string): void;
}) {
  if (!result.drops.length) {
    await invalidateGameData();
    return;
  }

  const sourceNode = document.querySelector<HTMLElement>(`[data-board-item-id="${cssEscape(producerBoardItemId)}"]`);
  const sourceRect = sourceNode ? snapshotRect(sourceNode.getBoundingClientRect()) : null;

  setHiddenBoardItemIds(new Set(result.drops.map((drop) => drop.boardItemId)));
  await invalidateGameData();
  await wait(40);

  for (const drop of result.drops) {
    const targetCellKey = boardCellKey(drop.x, drop.y);
    const targetNode = document.querySelector<HTMLElement>(`[data-board-cell-id="${targetCellKey}"]`);

    if (sourceRect && targetNode) {
      setFlyout({
        id: Date.now() + Math.random(),
        itemId: drop.itemId,
        from: sourceRect,
        to: snapshotRect(targetNode.getBoundingClientRect()),
      });
      await wait(stashAnimationMs);
    }

    setHiddenBoardItemIds((current) => {
      const next = new Set(current);
      next.delete(drop.boardItemId);
      return next;
    });
    pulseBoard(targetCellKey);
    setFlyout(null);
    await wait(90);
  }
}
