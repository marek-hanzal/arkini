import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { resolveMergeRule, type BuildRecipeId, type ItemId } from "~/domains/game-data";
import type { BoardViewItem, ProducerDropResult } from "~/domains/database";
import { useGameAction, useGameDataInvalidation, useGameView } from "~/hooks/useGameView";
import { Board } from "./components/Board";
import { BuildSheet } from "./components/BuildSheet";
import { Flyer } from "./components/Flyer";
import { InventorySheet } from "./components/InventorySheet";
import { Tile } from "./components/Tile";
import { cellKey, cssEscape, inventorySinkRect, queryRect, tileVisualRect, wait, without } from "./helpers";
import { flyMs, type BuildCell, type CommittedDrag, type DragData, type DropData, type RectLike } from "./types";
import { useFlyers } from "./useFlyers";
import { useGameFeedback } from "./useGameFeedback";

export function GameShell() {
  const gameQuery = useGameView();
  const game = gameQuery.data;
  const invalidateGameData = useGameDataInvalidation();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [committedDrag, setCommittedDrag] = useState<CommittedDrag | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [buildCell, setBuildCell] = useState<BuildCell | null>(null);
  const [hiddenBoardIds, setHiddenBoardIds] = useState(() => new Set<string>());
  const [hiddenInventorySlots, setHiddenInventorySlots] = useState(() => new Set<number>());
  const { flyers, addFlyer } = useFlyers();
  const [nowMs, setNowMs] = useState(Date.now());
  const [dragPreviewRect, setDragPreviewRect] = useState<Pick<RectLike, "width" | "height"> | null>(null);
  const feedback = useGameFeedback();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const placeInventory = useGameAction((db, input: { slotIndex: number; x: number; y: number }) => db.placeInventoryItem(input.slotIndex, input.x, input.y));
  const moveBoard = useGameAction((db, input: { boardItemId: string; x: number; y: number }) => db.moveBoardItem(input.boardItemId, input.x, input.y));
  const stashBoard = useGameAction((db, input: { boardItemId: string; slotIndex?: number }) => db.stashBoardItem(input.boardItemId, input.slotIndex));
  const swapInventory = useGameAction((db, input: { sourceSlotIndex: number; targetSlotIndex: number }) => db.swapInventorySlots(input.sourceSlotIndex, input.targetSlotIndex));
  const mergeBoard = useGameAction((db, input: { sourceBoardItemId: string; targetBoardItemId: string }) => db.mergeBoardItems(input.sourceBoardItemId, input.targetBoardItemId));
  const produce = useGameAction(
    (db, input: { boardItemId: string; activation?: "single" | "exhaust" }) =>
      db.produceBoardItem(input.boardItemId, input.activation),
    { invalidateOnSuccess: false },
  );
  const advanceAuto = useGameAction((db) => db.advanceAutoProducers(), { invalidateOnSuccess: false });
  const build = useGameAction((db, input: { recipeId: BuildRecipeId; x: number; y: number }) => db.buildRecipe(input.recipeId, input.x, input.y));

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (advanceAuto.isPending) return;
      advanceAuto.mutate(undefined, {
        async onSuccess(results) {
          if (results.length === 0) return;
          await animateProducerDrops(results);
          await invalidateGameData();
        },
        onError(error) {
          feedback.showError(error);
        },
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [advanceAuto, invalidateGameData]);

  function handleDragStart(event: DragStartEvent) {
    setCommittedDrag(null);
    setActiveDrag(event.active.data.current as DragData | null);
    const rect = (event.active.rect.current.initial ?? event.active.rect.current.translated) as RectLike | null;
    setDragPreviewRect(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleDragCancel() {
    setActiveDrag(null);
    setCommittedDrag(null);
    setDragPreviewRect(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const source = event.active.data.current as DragData | undefined;
    const target = event.over?.data.current as DropData | undefined;
    const dragRect = (event.active.rect.current.translated ?? event.active.rect.current.initial) as RectLike | null;
    setDragPreviewRect(null);

    if (!source || !target || !game) {
      setActiveDrag(null);
      return;
    }

    if (isRejectedBoardMerge(source, target)) {
      await animateRejectedDrop(source, dragRect);
      feedback.flashInvalidTarget(source, target, game);
      return;
    }

    setActiveDrag(null);

    try {
      await runDropAction(source, target);
    } catch (error) {
      setCommittedDrag(null);
      await animateRejectedDrop(source, dragRect);
      feedback.flashInvalidTarget(source, target, game);
      feedback.showError(error);
    }
  }

  async function runDropAction(source: DragData, target: DropData) {
    if (source.kind === "inventory" && target.kind === "cell") {
      if (target.boardItemId) throw new Error("Cell is occupied.");
      setCommittedDrag({ source, hideSource: source.quantity <= 1 });
      await placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "inventory" && target.kind === "inventory-slot") {
      if (source.slotIndex === target.slotIndex) return;

      const hiddenSlots = await animateInventorySwap(source, target.slotIndex);
      try {
        await swapInventory.mutateAsync({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex });
        feedback.pulseInventorySlot(target.slotIndex);
      } finally {
        for (const slotIndex of hiddenSlots) showInventorySlot(slotIndex);
        setCommittedDrag(null);
      }
      return;
    }

    if (source.kind === "board" && target.kind === "cell") {
      if (target.boardItemId === source.boardItemId) return;

      setCommittedDrag({ source, hideSource: true });
      if (target.boardItemId) {
        await mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId: target.boardItemId });
        feedback.pulseMergeCell(cellKey(target.x, target.y));
        setCommittedDrag(null);
        return;
      }

      await moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "inventory-slot") {
      setCommittedDrag({ source, hideSource: true });
      await stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: target.slotIndex });
      feedback.pulseInventorySlot(target.slotIndex);
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "inventory-bin") {
      setCommittedDrag({ source, hideSource: true });
      await stashBoard.mutateAsync({ boardItemId: source.boardItemId });
      setCommittedDrag(null);
    }
  }

  async function produceFrom(boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") {
    try {
      const result = await produce.mutateAsync({ boardItemId: boardItem.id, activation });
      await animateProducerDrops([result], activation === "exhaust" ? 130 : 0);
      await invalidateGameData();
      feedback.pulseBoardCell(cellKey(boardItem.x, boardItem.y));
    } catch (error) {
      feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
      feedback.showError(error);
    }
  }

  async function animateProducerDrops(results: ProducerDropResult[], stepDelayMs = 0) {
    for (const result of results) {
      const sourceRect = queryRect(`[data-board-item-id="${cssEscape(result.producerBoardItemId)}"]`);
      if (!sourceRect) continue;
      const from = tileVisualRect(sourceRect);

      for (const placement of result.placements) {
        const targetRect = placement.kind === "board"
          ? queryRect(`[data-board-cell="${placement.x}:${placement.y}"]`)
          : sheetOpen ? queryRect(`[data-inventory-slot="${placement.slotIndex}"]`) : null;

        if (placement.kind === "board") {
          if (!targetRect) continue;
          addFlyer(placement.itemId, from, tileVisualRect(targetRect));
        } else {
          addFlyer(placement.itemId, from, targetRect ? tileVisualRect(targetRect) : inventorySinkRect(from));
        }

        if (stepDelayMs > 0) await wait(stepDelayMs);
      }
    }

    await wait(flyMs);
  }

  async function animateInventorySwap(source: Extract<DragData, { kind: "inventory" }>, targetSlotIndex: number) {
    const sourceSlot = game?.inventoryBySlotIndex[source.slotIndex] ?? null;
    const targetSlot = game?.inventoryBySlotIndex[targetSlotIndex] ?? null;
    const sourceRect = queryRect(`[data-inventory-slot="${source.slotIndex}"]`);
    const targetRect = queryRect(`[data-inventory-slot="${targetSlotIndex}"]`);
    const hiddenSlots = [source.slotIndex];

    setCommittedDrag({ source, hideSource: true });
    if (!sourceSlot?.stack || !sourceRect || !targetRect) return hiddenSlots;

    hideInventorySlot(source.slotIndex);
    addFlyer(sourceSlot.stack.itemId, tileVisualRect(sourceRect), tileVisualRect(targetRect));

    const shouldSwapBack = Boolean(targetSlot?.stack && targetSlot.stack.itemId !== sourceSlot.stack.itemId);
    if (shouldSwapBack && targetSlot?.stack) {
      hiddenSlots.push(targetSlotIndex);
      hideInventorySlot(targetSlotIndex);
      addFlyer(targetSlot.stack.itemId, tileVisualRect(targetRect), tileVisualRect(sourceRect));
    }

    await wait(flyMs);
    return hiddenSlots;
  }

  async function animateRejectedDrop(source: DragData, dragRect: RectLike | null) {
    const from = dragRect ? tileVisualRect(dragRect) : null;
    if (!from) {
      setActiveDrag(null);
      return;
    }

    if (source.kind === "board") {
      const boardItem = game?.boardItemsById[source.boardItemId];
      const targetRect = boardItem ? queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`) : null;
      if (!targetRect) {
        setActiveDrag(null);
        return;
      }

      hideBoardItem(source.boardItemId);
      setActiveDrag(null);
      addFlyer(source.itemId, from, tileVisualRect(targetRect));
      await wait(flyMs);
      showBoardItem(source.boardItemId);
      return;
    }

    const targetRect = queryRect(`[data-inventory-slot="${source.slotIndex}"]`);
    if (!targetRect) {
      setActiveDrag(null);
      return;
    }

    hideInventorySlot(source.slotIndex);
    setActiveDrag(null);
    addFlyer(source.itemId, from, tileVisualRect(targetRect));
    await wait(flyMs);
    showInventorySlot(source.slotIndex);
  }

  function isRejectedBoardMerge(source: DragData, target: DropData) {
    if (source.kind !== "board" || target.kind !== "cell" || !target.boardItemId) return false;
    if (target.boardItemId === source.boardItemId) return false;
    const targetItem = game?.boardItemsById[target.boardItemId];
    if (!targetItem) return false;
    return !resolveMergeRule(source.itemId as ItemId, targetItem.itemId as ItemId);
  }

  function hideBoardItem(id: string) {
    setHiddenBoardIds((current) => new Set(current).add(id));
  }

  function showBoardItem(id: string) {
    setHiddenBoardIds((current) => without(current, id));
  }

  function hideInventorySlot(slotIndex: number) {
    setHiddenInventorySlots((current) => new Set(current).add(slotIndex));
  }

  function showInventorySlot(slotIndex: number) {
    setHiddenInventorySlots((current) => without(current, slotIndex));
  }

  if (gameQuery.isPending) {
    return <div className="grid h-[70vh] w-[min(100vw-1.5rem,430px)] place-items-center text-sm text-slate-400">Booting SQLite…</div>;
  }

  if (gameQuery.isError || !game) {
    return <div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">{(gameQuery.error as Error)?.message ?? "Game failed to load."}</div>;
  }

  const activeItem = activeDrag ? game.items[activeDrag.itemId] : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <section className="relative flex w-[min(100vw-1.5rem,430px)] flex-col gap-3 pb-3">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">Arkini</p>
          <h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
        </div>

        <Board
          game={game}
          activeDrag={activeDrag}
          committedDrag={committedDrag}
          hiddenBoardIds={hiddenBoardIds}
          invalidBoardCellKey={feedback.invalidBoardCellKey}
          pulsedBoardCellKey={feedback.pulsedBoardCellKey}
          mergedBoardCellKey={feedback.mergedBoardCellKey}
          nowMs={nowMs}
          onEmptyDoubleActivate={setBuildCell}
          onTileSingleActivate={(item) => {
            if (!item.producer) return;
            void produceFrom(item, "single");
          }}
        />

        <BuildSheet
          game={game}
          cell={buildCell}
          onClose={() => setBuildCell(null)}
          onBuild={(recipeId) => {
            if (!buildCell) return;
            build.mutate(
              { recipeId, x: buildCell.x, y: buildCell.y },
              {
                onSuccess: () => {
                  feedback.pulseBoardCell(cellKey(buildCell.x, buildCell.y));
                  setBuildCell(null);
                },
                onError(error) {
                  feedback.flashBoardCell(cellKey(buildCell.x, buildCell.y), "error");
                  feedback.showError(error);
                },
              },
            );
          }}
        />
      </section>

      <InventorySheet
        game={game}
        open={sheetOpen}
        hiddenInventorySlots={hiddenInventorySlots}
        committedDrag={committedDrag}
        activeDrag={activeDrag}
        invalidInventorySlot={feedback.invalidInventorySlot}
        pulsedInventorySlot={feedback.pulsedInventorySlot}
        onOpenChange={setSheetOpen}
      />

      {flyers.map((flyer) => <Flyer key={flyer.id} flyer={flyer} item={game.items[flyer.itemId]} />)}

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <Tile
            item={activeItem}
            dragOverlay
            quantity={activeDrag?.kind === "inventory" ? 1 : undefined}
            overlaySize={dragPreviewRect}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
