import { useCallback } from "react";
import type { GameView } from "~/domains/database";
import { useGameDataInvalidation } from "~/hooks/useGameView";
import { revealProducerDrops } from "~/features/game/animations/revealProducerDrops";
import { stashAnimationMs } from "~/features/game/components/constants";
import { cellId } from "~/features/game/components/helpers/cellId";
import { cellKey } from "~/features/game/components/helpers/cellKey";
import { cssEscape } from "~/features/game/components/helpers/cssEscape";
import { rectOf } from "~/features/game/components/helpers/rectOf";
import { wait } from "~/features/game/components/helpers/wait";
import { findFreeCell } from "~/features/game/components/helpers/findFreeCell";
import { findInventorySlot } from "~/features/game/components/helpers/findInventorySlot";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { useGameFeedback } from "./useGameFeedback";
import type { GameMutations } from "./useGameMutations";

export function useFlyoutActions(game: GameView | null | undefined, mutations: GameMutations) {
  const invalidateGameData = useGameDataInvalidation();
  const { markInvalid, pulseInventory, pulseBoard, showActionError } = useGameFeedback();
  const setSelection = useGameUiStore((state) => state.setSelection);
  const setCommittedDrag = useGameUiStore((state) => state.setCommittedDrag);
  const setFlyout = useGameUiStore((state) => state.setFlyout);
  const setHiddenBoardItemIds = useGameUiStore((state) => state.setHiddenBoardItemIds);
  const setBuildCell = useGameUiStore((state) => state.setBuildCell);

  const handleStash = useCallback(
    async (boardItemId: string, itemId: string) => {
      if (!game) return;

      const targetSlotIndex = findInventorySlot(game, itemId);
      if (targetSlotIndex === null) {
        markInvalid(boardItemId);
        return;
      }

      setCommittedDrag({ type: "board", boardItemId });
      await animateFlyout({
        itemId,
        setFlyout,
        sourceSelector: `[data-board-item-id="${cssEscape(boardItemId)}"]`,
        targetSelector: `[data-inventory-slot-index="${targetSlotIndex}"]`,
      });

      try {
        await mutations.stashBoard.mutateAsync({ boardItemId, slotIndex: targetSlotIndex });
        pulseInventory(targetSlotIndex);
        setSelection(null);
      } catch (error) {
        showActionError(error, boardItemId);
      } finally {
        setFlyout(null);
        setCommittedDrag(null);
      }
    },
    [game, markInvalid, mutations.stashBoard, pulseInventory, setCommittedDrag, setFlyout, setSelection, showActionError],
  );

  const handleProduce = useCallback(
    async (boardItemId: string) => {
      setSelection({ type: "board", boardItemId });

      try {
        const result = await mutations.produce.mutateAsync({ boardItemId });
        await revealProducerDrops({
          producerBoardItemId: boardItemId,
          result,
          invalidateGameData,
          setHiddenBoardItemIds,
          setFlyout,
          pulseBoard,
        });
      } catch (error) {
        showActionError(error, boardItemId);
      } finally {
        setFlyout(null);
        setHiddenBoardItemIds(new Set());
      }
    },
    [invalidateGameData, mutations.produce, pulseBoard, setFlyout, setHiddenBoardItemIds, setSelection, showActionError],
  );

  const handlePlaceStack = useCallback(
    async (slotIndex: number, itemId: string) => {
      if (!game) return;

      const targetCell = findFreeCell(game);
      if (!targetCell) {
        markInvalid(`inventory:${slotIndex}`);
        return;
      }

      const key = cellKey(targetCell.x, targetCell.y);
      setCommittedDrag({ type: "inventory", slotIndex });
      await animateFlyout({
        itemId,
        setFlyout,
        sourceSelector: `[data-inventory-slot-index="${slotIndex}"]`,
        targetSelector: `[data-board-cell-id="${key}"]`,
      });

      try {
        await mutations.placeInventory.mutateAsync({ slotIndex, x: targetCell.x, y: targetCell.y });
        pulseBoard(key);
        setSelection(null);
      } catch (error) {
        showActionError(error, `inventory:${slotIndex}`);
      } finally {
        setFlyout(null);
        setCommittedDrag(null);
      }
    },
    [game, markInvalid, mutations.placeInventory, pulseBoard, setCommittedDrag, setFlyout, setSelection, showActionError],
  );

  const handleBuild = useCallback(
    async (recipeId: string) => {
      const target = useGameUiStore.getState().buildCell;
      if (!target) return;
      setBuildCell(null);

      try {
        await mutations.build.mutateAsync({ recipeId, x: target.x, y: target.y });
        pulseBoard(cellKey(target.x, target.y));
        setSelection(null);
      } catch (error) {
        showActionError(error, cellId(target.x, target.y));
      }
    },
    [mutations.build, pulseBoard, setBuildCell, setSelection, showActionError],
  );

  const handleCloseBuild = useCallback(() => setBuildCell(null), [setBuildCell]);

  return { handleBuild, handleCloseBuild, handlePlaceStack, handleProduce, handleStash };
}

async function animateFlyout({
  itemId,
  setFlyout,
  sourceSelector,
  targetSelector,
}: {
  itemId: string;
  setFlyout: ReturnType<typeof useGameUiStore.getState>["setFlyout"];
  sourceSelector: string;
  targetSelector: string;
}) {
  const sourceNode = document.querySelector<HTMLElement>(sourceSelector);
  const targetNode = document.querySelector<HTMLElement>(targetSelector);
  if (!sourceNode || !targetNode) return;

  setFlyout({
    id: Date.now(),
    itemId,
    from: rectOf(sourceNode.getBoundingClientRect()),
    to: rectOf(targetNode.getBoundingClientRect()),
  });
  await wait(stashAnimationMs);
}
