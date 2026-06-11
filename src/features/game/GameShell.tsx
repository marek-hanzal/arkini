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
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
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
import { boardPulseMs, invalidDropReturnMs, mergePulseMs, stashAnimationMs } from "~/features/game/components/constants";
import { boardCellId, boardCellKey, parseBoardCellId } from "~/features/game/components/helpers/boardCellId";
import { canMergeBoardItems } from "~/features/game/components/helpers/canMergeBoardItems";
import { canStashBoardItem } from "~/features/game/components/helpers/canStashBoardItem";
import { cssEscape, snapshotRect, wait } from "~/features/game/components/helpers/dom";
import { findFirstFreeBoardCell } from "~/features/game/components/helpers/findFirstFreeBoardCell";
import { getInventoryPreviewSlot } from "~/features/game/components/helpers/getInventoryPreviewSlot";
import { resolveInventoryDestination } from "~/features/game/components/helpers/resolveInventoryDestination";
import type { BuildCell, DragData, DropData, Flyout, Selection } from "~/features/game/components/types";
import { useGameDataInvalidation, useGameView } from "~/hooks/useGameView";
import { revealProducerDrops } from "~/features/game/animations/revealProducerDrops";
import { useGameMutations } from "~/features/game/hooks/useGameMutations";

export function GameShell() {
  const game = useGameView();
  const [selection, setSelection] = useState<Selection>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);
  const [committedDrag, setCommittedDrag] = useState<DragData | null>(null);
  const [returningDrag, setReturningDrag] = useState<DragData | null>(null);
  const [invalidTargetId, setInvalidTargetId] = useState<string | null>(null);
  const [inventoryPulseSlot, setInventoryPulseSlot] = useState<number | null>(null);
  const [boardPulseCell, setBoardPulseCell] = useState<string | null>(null);
  const [mergePulseBoardItemId, setMergePulseBoardItemId] = useState<string | null>(null);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const [hiddenBoardItemIds, setHiddenBoardItemIds] = useState<Set<string>>(() => new Set());
  const [buildCell, setBuildCell] = useState<BuildCell>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [splashReady, setSplashReady] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSplashReady(true), 900);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (activeDrag) return;

    const interval = window.setInterval(() => setNowMs(Date.now()), 150);
    return () => window.clearInterval(interval);
  }, [activeDrag]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const invalidateGameData = useGameDataInvalidation();

  const { placeInventory, moveBoard, stashBoard, mergeBoard, swapInventory, produce, build } = useGameMutations();

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

  function markInvalid(targetId?: string) {
    if (!targetId) return;
    setInvalidTargetId(targetId);
    window.setTimeout(() => setInvalidTargetId(null), 650);
  }

  function pulseInventory(slotIndex: number | null | undefined) {
    if (slotIndex === null || slotIndex === undefined) return;
    setInventoryPulseSlot(slotIndex);
    window.setTimeout(() => setInventoryPulseSlot(null), 700);
  }

  function pulseBoard(cellKey: string | null | undefined) {
    if (!cellKey) return;
    setBoardPulseCell(cellKey);
    window.setTimeout(() => setBoardPulseCell(null), boardPulseMs);
  }

  function pulseMerge(boardItemId: string) {
    setMergePulseBoardItemId(boardItemId);
    window.setTimeout(() => setMergePulseBoardItemId(null), mergePulseMs);
  }

  function showActionError(error: unknown, invalidId?: string) {
    markInvalid(invalidId);
    if (invalidId) return;
    toast.error(error instanceof Error ? error.message : "Action failed.");
  }

  async function runDrop(action: () => Promise<unknown>, source: DragData, invalidId?: string, onSuccess?: () => void) {
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
  }

  function pulseDragOrigin(source: DragData) {
    if (!game.data) return;

    if (source.type === "inventory") {
      pulseInventory(source.slotIndex);
      return;
    }

    if (source.type === "board") {
      const boardItem = game.data.boardItems.find((item) => item.id === source.boardItemId);
      if (!boardItem) return;
      pulseBoard(boardCellKey(boardItem.x, boardItem.y));
    }
  }

  function rejectDrop(source: DragData, invalidId?: string) {
    setReturningDrag(source);
    markInvalid(invalidId);
    window.setTimeout(() => {
      setActiveDrag(null);
      setReturningDrag(null);
      pulseDragOrigin(source);
    }, invalidDropReturnMs + 100);
  }

  async function stashWithFlyout(boardItemId: string, itemId: string) {
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
  }

  async function produceWithSequence(boardItemId: string) {
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
  }

  async function placeInventoryWithFlyout(slotIndex: number, itemId: string) {
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
  }

  async function buildIntoCell(recipeId: string) {
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
  }

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

        if (!canStashBoardItem(game.data, source.boardItemId, nowMs)) {
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

  const inventoryPreviewSlot = getInventoryPreviewSlot(game.data, activeDrag, activeOverId, nowMs);
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
              nowMs={nowMs}
              onSelect={setSelection}
              onProduce={(boardItemId) => void produceWithSequence(boardItemId)}
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
              onPlaceStack={(slotIndex, itemId) => void placeInventoryWithFlyout(slotIndex, itemId)}
            />
          </div>

          <div className="grid w-full gap-3 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
            <ActionPanel
              game={game.data}
              selection={selection}
              pending={pending}
              invalidTargetId={invalidTargetId}
            />
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
      <BuildModal game={game.data} cell={buildCell} pending={pending} onClose={() => setBuildCell(null)} onBuild={(recipeId) => void buildIntoCell(recipeId)} />
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
