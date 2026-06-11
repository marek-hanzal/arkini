import type { ProducerDropResult } from "~/domains/database";
import { stashAnimationMs } from "~/features/game/components/constants";
import { cellKey } from "~/features/game/components/helpers/cellKey";
import { rectOf } from "~/features/game/components/helpers/rectOf";
import { wait } from "~/features/game/components/helpers/wait";
import type { Flyout } from "~/features/game/components/types";

type HiddenBoardItemSetter = (next: ReadonlySet<string> | ((current: ReadonlySet<string>) => ReadonlySet<string>)) => void;
type FlyoutSetter = (next: Flyout | null) => void;

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
  setHiddenBoardItemIds: HiddenBoardItemSetter;
  setFlyout: FlyoutSetter;
  pulseBoard(cellKey: string): void;
}) {
  if (!result.drops.length) {
    await invalidateGameData();
    return;
  }

  const sourceNode = document.querySelector<HTMLElement>(`[data-board-item-id="${producerBoardItemId}"]`);
  const sourceRect = sourceNode ? rectOf(sourceNode.getBoundingClientRect()) : null;

  setHiddenBoardItemIds(new Set(result.drops.map((drop) => drop.boardItemId)));
  await invalidateGameData();
  await wait(40);

  for (const drop of result.drops) {
    const targetCellKey = cellKey(drop.x, drop.y);
    const targetNode = document.querySelector<HTMLElement>(`[data-board-cell-id="${targetCellKey}"]`);

    if (sourceRect && targetNode) {
      setFlyout({
        id: Date.now() + Math.random(),
        itemId: drop.itemId,
        from: sourceRect,
        to: rectOf(targetNode.getBoundingClientRect()),
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
