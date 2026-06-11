import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useCallback } from "react";
import { Toaster } from "sonner";
import { match } from "ts-pattern";
import type { GameView } from "~/domains/database";
import { DbStatusCard } from "~/components/DbStatusCard";
import { ActionPanel } from "~/features/game/components/ActionPanel";
import { BuildModal } from "~/features/game/components/BuildModal";
import { BoardPanel } from "~/features/game/components/BoardPanel";
import { DragPreview } from "~/features/game/components/DragPreview";
import { FlyoutTile } from "~/features/game/components/FlyoutTile";
import { GameCard } from "~/features/game/components/GameCard";
import { InventoryPanel } from "~/features/game/components/InventoryPanel";
import { SplashScreen } from "~/features/game/components/SplashScreen";
import { invalidDropReturnMs, stashAnimationMs } from "~/features/game/components/constants";
import { boardCellId, boardCellKey, parseBoardCellId } from "~/features/game/components/helpers/boardCellId";
import { canMergeBoardItems } from "~/features/game/components/helpers/canMergeBoardItems";
import { canStashBoardItem } from "~/features/game/components/helpers/canStashBoardItem";
import { cssEscape, snapshotRect, wait } from "~/features/game/components/helpers/dom";
import { findFirstFreeBoardCell } from "~/features/game/components/helpers/findFirstFreeBoardCell";
import { getInventoryPreviewSlot } from "~/features/game/components/helpers/getInventoryPreviewSlot";
import { resolveInventoryDestination } from "~/features/game/components/helpers/resolveInventoryDestination";
import type { DragData, DropData } from "~/features/game/components/types";
import { useGameDataInvalidation, useGameView } from "~/hooks/useGameView";
import { revealProducerDrops } from "~/features/game/animations/revealProducerDrops";
import { useGameMutations } from "~/features/game/hooks/useGameMutations";
import { useGameFeedback } from "~/features/game/hooks/useGameFeedback";
import { useCooldownClock } from "~/features/game/hooks/useCooldownClock";
import { useSplashDelay } from "~/features/game/hooks/useSplashDelay";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export function GameShell() {
  const game = useGameView();
  const selection = useGameUiStore((state) => state.selection);
  const activeDrag = useGameUiStore((state) => state.activeDrag);
  const activeOverId = useGameUiStore((state) => state.activeOverId);
  const committedDrag = useGameUiStore((state) => state.committedDrag);
  const returningDrag = useGameUiStore((state) => state.returningDrag);
  const invalidTargetId = useGameUiStore((state) => state.invalidTargetId);
  const inventoryPulseSlot = useGameUiStore((state) => state.inventoryPulseSlot);
  const boardPulseCell = useGameUiStore((state) => state.boardPulseCell);
  const mergePulseBoardItemId = useGameUiStore((state) => state.mergePulseBoardItemId);
  const flyout = useGameUiStore((state) => state.flyout);
  const hiddenBoardItemIds = useGameUiStore((state) => state.hiddenBoardItemIds);
  const buildCell = useGameUiStore((state) => state.buildCell);
  const splashReady = useGameUiStore((state) => state.splashReady);
  const setSelection = useGameUiStore((state) => state.setSelection);
  const setActiveDrag = useGameUiStore((state) => state.setActiveDrag);
  const setActiveOverId = useGameUiStore((state) => state.setActiveOverId);
  const setCommittedDrag = useGameUiStore((state) => state.setCommittedDrag);
  const setReturningDrag = useGameUiStore((state) => state.setReturningDrag);
  const setFlyout = useGameUiStore((state) => state.setFlyout);
  const setHiddenBoardItemIds = useGameUiStore((state) => state.setHiddenBoardItemIds);
  const setBuildCell = useGameUiStore((state) => state.setBuildCell);
  useSplashDelay(1500);
  useCooldownClock(150);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const invalidateGameData = useGameDataInvalidation();

  const { placeInventory, moveBoard, stashBoard, mergeBoard, swapInventory, produce, build } = useGameMutations();
  const { markInvalid, pulseInventory, pulseBoard, pulseMerge, pulseDragOrigin, showActionError } = useGameFeedback();

  const pending =
    placeInventory.isPending ||
    moveBoard.isPending ||
    stashBoard.isPending ||
    mergeBoard.isPending ||
    swapInventory.isPending ||
    produce.isPending ||
    build.isPending ||
    flyout !== null ||
    hiddenBoardItemIds.size > 0 ||
    returningDrag !== null;

  const runDrop = useCallback(
    async (action: () => Promise<unknown>, source: DragData, invalidId?: string, onSuccess?: () => void) => {
      setCommittedDrag(source);
      setReturningDrag(null);
      setActiveDrag(null);

      try {
        await action();
        onSuccess?.();
        setSelection(null);
      } catch (error) {
        setCommittedDrag(null);
        showActionError(error, invalidId);
        return;
      }

      setCommittedDrag(null);
    },
    [setActiveDrag, setCommittedDrag, setReturningDrag, setSelection, showActionError],
  );

  const rejectDrop = useCallback(
    (source: DragData, invalidId?: string) => {
      setReturningDrag(source);
      setActiveDrag(null);
      markInvalid(invalidId);
      window.setTimeout(() => {
        setReturningDrag(null);
        pulseDragOrigin(game.data, source);
      }, invalidDropReturnMs + 120);
    },
    [game.data, markInvalid, pulseDragOrigin, setActiveDrag, setReturningDrag],
  );

  const stashWithFlyout = useCallback(
    async (boardItemId: string, itemId: string) => {
      if (!game.data) return;

      const targetSlotIndex = resolveInventoryDestination(game.data, itemId);
      if (targetSlotIndex === null) {
        markInvalid(boardItemId);
        return;
      }

      const sourceNode = document.querySelector<HTMLElement>(`[data-board-item-id="${cssEscape(boardItemId)}"]`);
      const targetNode = document.querySelector<HTMLElement>(`[data-inventory-slot-index="${targetSlotIndex}"]`);

      setCommittedDrag({ type: "board", boardItemId });

      if (sourceNode && targetNode) {
        setFlyout({
          id: Date.now(),
          itemId,
          from: snapshotRect(sourceNode.getBoundingClientRect()),
          to: snapshotRect(targetNode.getBoundingClientRect()),
        });
        await wait(stashAnimationMs);
      }

      try {
        await stashBoard.mutateAsync({ boardItemId, slotIndex: targetSlotIndex });
        pulseInventory(targetSlotIndex);
        setSelection(null);
      } catch (error) {
        showActionError(error, boardItemId);
      } finally {
        setFlyout(null);
        setCommittedDrag(null);
      }
    },
    [game.data, markInvalid, pulseInventory, setCommittedDrag, setFlyout, setSelection, showActionError, stashBoard],
  );

  const produceWithSequence = useCallback(
    async (boardItemId: string) => {
      setSelection({ type: "board", boardItemId });

      try {
        const result = await produce.mutateAsync({ boardItemId });
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
    [invalidateGameData, produce, pulseBoard, setFlyout, setHiddenBoardItemIds, setSelection, showActionError],
  );

  const placeInventoryWithFlyout = useCallback(
    async (slotIndex: number, itemId: string) => {
      if (!game.data) return;

      const targetCell = findFirstFreeBoardCell(game.data);
      if (!targetCell) {
        markInvalid(`inventory:${slotIndex}`);
        return;
      }

      const cellKey = boardCellKey(targetCell.x, targetCell.y);
      const sourceNode = document.querySelector<HTMLElement>(`[data-inventory-slot-index="${slotIndex}"]`);
      const targetNode = document.querySelector<HTMLElement>(`[data-board-cell-id="${cellKey}"]`);

      setCommittedDrag({ type: "inventory", slotIndex });

      if (sourceNode && targetNode) {
        setFlyout({
          id: Date.now(),
          itemId,
          from: snapshotRect(sourceNode.getBoundingClientRect()),
          to: snapshotRect(targetNode.getBoundingClientRect()),
        });
        await wait(stashAnimationMs);
      }

      try {
        await placeInventory.mutateAsync({ slotIndex, x: targetCell.x, y: targetCell.y });
        pulseBoard(cellKey);
        setSelection(null);
      } catch (error) {
        showActionError(error, `inventory:${slotIndex}`);
      } finally {
        setFlyout(null);
        setCommittedDrag(null);
      }
    },
    [game.data, markInvalid, placeInventory, pulseBoard, setCommittedDrag, setFlyout, setSelection, showActionError],
  );

  const buildIntoCell = useCallback(
    async (recipeId: string) => {
      if (!buildCell) return;
      const target = buildCell;
      setBuildCell(null);

      try {
        await build.mutateAsync({ recipeId, x: target.x, y: target.y });
        pulseBoard(boardCellKey(target.x, target.y));
        setSelection(null);
      } catch (error) {
        showActionError(error, boardCellId(target.x, target.y));
      }
    },
    [build, buildCell, pulseBoard, setBuildCell, setSelection, showActionError],
  );

  const handleProduce = useCallback((boardItemId: string) => {
    void produceWithSequence(boardItemId);
  }, [produceWithSequence]);

  const handlePlaceStack = useCallback((slotIndex: number, itemId: string) => {
    void placeInventoryWithFlyout(slotIndex, itemId);
  }, [placeInventoryWithFlyout]);

  const handleBuild = useCallback((recipeId: string) => {
    void buildIntoCell(recipeId);
  }, [buildIntoCell]);

  const handleCloseBuild = useCallback(() => {
    setBuildCell(null);
  }, [setBuildCell]);

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag(event.active.data.current as DragData | null);
    setReturningDrag(null);
    setActiveOverId(null);
  }

  function handleDragOver(event: DragOverEvent) {
    setActiveOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
    setReturningDrag(null);
    setActiveOverId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    const overId = event.over ? String(event.over.id) : undefined;
    setActiveOverId(null);

    if (!active || !game.data) {
      setActiveDrag(null);
      markInvalid(overId ?? String(event.active.id));
      return;
    }

    const reject = (invalidId = overId ?? String(event.active.id)) => rejectDrop(active, invalidId);

    if (!over) {
      reject(String(event.active.id));
      return;
    }

    void match([active, over] as const)
      .with([{ type: "inventory" }, { type: "board-cell" }], ([source, target]) => {
        if (target.boardItemId) {
          reject(overId);
          return;
        }
        void runDrop(
          () => placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y }),
          active,
          overId,
          () => pulseBoard(boardCellKey(target.x, target.y)),
        );
      })
      .with([{ type: "inventory" }, { type: "inventory-slot" }], ([source, target]) => {
        if (source.slotIndex === target.slotIndex) {
          reject(overId);
          return;
        }
        void runDrop(
          () => swapInventory.mutateAsync({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex }),
          active,
          overId,
          () => pulseInventory(target.slotIndex),
        );
      })
      .with([{ type: "board" }, { type: "board-cell" }], ([source, target]) => {
        if (source.boardItemId === target.boardItemId) {
          reject(overId);
          return;
        }

        const targetBoardItemId = target.boardItemId;
        if (targetBoardItemId) {
          if (!canMergeBoardItems(game.data, source.boardItemId, targetBoardItemId)) {
            reject(overId);
            return;
          }

          void runDrop(
            () => mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId }),
            active,
            overId,
            () => pulseMerge(targetBoardItemId),
          );
          return;
        }

        void runDrop(
          () => moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y }),
          active,
          overId,
          () => pulseBoard(boardCellKey(target.x, target.y)),
        );
      })
      .with([{ type: "board" }, { type: "inventory-slot" }], ([source, target]) => {
        const boardItem = game.data.boardItems.find((item) => item.id === source.boardItemId);
        if (!boardItem) {
          reject(overId);
          return;
        }

        if (!canStashBoardItem(game.data, source.boardItemId, Date.now())) {
          reject(source.boardItemId);
          return;
        }

        const targetSlotIndex = resolveInventoryDestination(game.data, boardItem.itemId, target.slotIndex);
        if (targetSlotIndex === null) {
          reject(overId);
          return;
        }

        void runDrop(
          () => stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: targetSlotIndex }),
          active,
          `inventory:${targetSlotIndex}`,
          () => pulseInventory(targetSlotIndex),
        );
      })
      .otherwise(() => reject(overId));
  }

  if (game.isLoading || !splashReady) {
    return <SplashScreen />;
  }

  if (game.isError) {
    return <GameCard title="Game failed">{(game.error as Error).message}</GameCard>;
  }

  if (!game.data) return null;

  const inventoryPreviewSlot = getInventoryPreviewSlot(game.data, activeDrag, activeOverId, Date.now());
  const hiddenDrag = committedDrag ?? returningDrag;
  const overlayFaded = isMergeOverlayFaded(game.data, activeDrag, activeOverId);

  return (
    <>
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/60",
            error: "border-red-400/40 bg-red-950 text-red-50",
          },
        }}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <section className="flex w-fit max-w-full flex-col gap-3">
          <div className="flex w-fit max-w-full items-start gap-3 overflow-x-auto pb-1">
            <BoardPanel
              game={game.data}
              selection={selection}
              activeDrag={activeDrag}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={hiddenDrag}
              hiddenBoardItemIds={hiddenBoardItemIds}
              mergePulseBoardItemId={mergePulseBoardItemId}
              boardPulseCell={boardPulseCell}
              onSelect={setSelection}
              onProduce={handleProduce}
              onStash={stashWithFlyout}
              onOpenBuild={setBuildCell}
            />
            <InventoryPanel
              game={game.data}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={hiddenDrag}
              previewSlotIndex={inventoryPreviewSlot}
              pulseSlotIndex={inventoryPulseSlot}
              onPlaceStack={handlePlaceStack}
            />
          </div>

          <div className="grid w-full gap-3 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
            <ActionPanel game={game.data} selection={selection} pending={pending} invalidTargetId={invalidTargetId} />
            <DbStatusCard />
          </div>
        </section>
        <DragOverlay
          dropAnimation={committedDrag ? null : { duration: invalidDropReturnMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          modifiers={[snapCenterToCursor]}
        >
          {activeDrag ? <DragPreview game={game.data} drag={activeDrag} faded={overlayFaded} /> : null}
        </DragOverlay>
      </DndContext>
      <BuildModal game={game.data} cell={buildCell} pending={pending} onClose={handleCloseBuild} onBuild={handleBuild} />
      {flyout ? <FlyoutTile game={game.data} flyout={flyout} /> : null}
    </>
  );
}

function isMergeOverlayFaded(game: GameView, activeDrag: DragData | null, activeOverId: string | null) {
  if (activeDrag?.type !== "board") return false;

  const targetCell = parseBoardCellId(activeOverId);
  if (!targetCell) return false;

  const target = game.boardItems.find((item) => item.x === targetCell.x && item.y === targetCell.y);
  if (!target) return false;

  return canMergeBoardItems(game, activeDrag.boardItemId, target.id);
}
