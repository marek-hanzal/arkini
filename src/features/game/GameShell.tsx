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
import { gameDataIndex, type BuildRecipeId, type ItemId } from "~/domains/game-data";
import type { BoardViewItem, InventorySlot, ProducerDropResult } from "~/domains/database";
import { useGameAction, useGameDataInvalidation, useGameView } from "~/hooks/useGameView";
import { Board } from "./components/Board";
import { BuildSheet } from "./components/BuildSheet";
import { Flyer } from "./components/Flyer";
import { InventorySheet } from "./components/InventorySheet";
import { Tile } from "./components/Tile";
import { cellKey, cssEscape, firstFreeCell, inventorySinkRect, queryRect, tileVisualRect, wait, without } from "./helpers";
import { flyMs, type BuildCell, type DragData, type DropData, type RectLike } from "./types";
import { useFlyers } from "./useFlyers";
import { useGameFeedback } from "./useGameFeedback";

export function GameShell() {
  const gameQuery = useGameView();
  const game = gameQuery.data;
  const invalidateGameData = useGameDataInvalidation();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [committedDrag, setCommittedDrag] = useState<DragData | null>(null);
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
  const togglePause = useGameAction((db, input: { boardItemId: string }) => db.toggleProducerPause(input.boardItemId));
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
    setActiveDrag(event.active.data.current as DragData | null);
    const rect = (event.active.rect.current.initial ?? event.active.rect.current.translated) as RectLike | null;
    setDragPreviewRect(rect ? { width: rect.width, height: rect.height } : null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const source = event.active.data.current as DragData | undefined;
    const target = event.over?.data.current as DropData | undefined;
    setActiveDrag(null);
    setDragPreviewRect(null);

    if (!source || !target || !game) return;

    try {
      await runDropAction(source, target);
    } catch (error) {
      setCommittedDrag(null);
      feedback.flashInvalidTarget(source, target, game);
      feedback.showError(error);
    }
  }

  async function runDropAction(source: DragData, target: DropData) {
    if (source.kind === "inventory" && target.kind === "cell") {
      if (target.boardItemId) throw new Error("Cell is occupied.");
      setCommittedDrag(source);
      await placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "inventory" && target.kind === "inventory-slot") {
      if (source.slotIndex === target.slotIndex) return;

      setCommittedDrag(source);
      await swapInventory.mutateAsync({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex });
      feedback.pulseInventorySlot(target.slotIndex);
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "cell") {
      if (target.boardItemId === source.boardItemId) return;

      setCommittedDrag(source);
      if (target.boardItemId) {
        await mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId: target.boardItemId });
        feedback.pulseBoardCell(cellKey(target.x, target.y));
        setCommittedDrag(null);
        return;
      }

      await moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "inventory-slot") {
      setCommittedDrag(source);
      await stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: target.slotIndex });
      feedback.pulseInventorySlot(target.slotIndex);
      setCommittedDrag(null);
      return;
    }

    if (source.kind === "board" && target.kind === "inventory-bin") {
      setCommittedDrag(source);
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

  async function stashWithFly(boardItem: BoardViewItem) {
    const rect = queryRect(`[data-board-item-id="${cssEscape(boardItem.id)}"]`);
    if (!rect) return;

    const from = tileVisualRect(rect);
    const to = inventorySinkRect(from);
    hideBoardItem(boardItem.id);
    addFlyer(boardItem.itemId, from, to, "stash");

    try {
      await wait(flyMs);
      await stashBoard.mutateAsync({ boardItemId: boardItem.id });
      feedback.pulseInventorySlot(game?.firstEmptyInventorySlotIndex ?? null);
    } catch (error) {
      showBoardItem(boardItem.id);
      feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
      feedback.showError(error);
    }
  }

  async function placeInventoryFromDoubleTap(slot: InventorySlot) {
    if (!slot.stack || !game) return;
    const cell = firstFreeCell(game);
    if (!cell) {
      feedback.flashInventorySlot(slot.slotIndex, "error");
      feedback.showError(new Error("Board is full."));
      return;
    }

    const sourceRect = queryRect(`[data-inventory-slot="${slot.slotIndex}"]`);
    const targetRect = queryRect(`[data-board-cell="${cell.x}:${cell.y}"]`);
    const isLastItem = slot.stack.quantity <= 1;

    if (sourceRect && targetRect) {
      if (isLastItem) hideInventorySlot(slot.slotIndex);
      addFlyer(slot.stack.itemId, tileVisualRect(sourceRect), tileVisualRect(targetRect));
    }

    try {
      await wait(sourceRect && targetRect ? flyMs : 0);
      await placeInventory.mutateAsync({ slotIndex: slot.slotIndex, x: cell.x, y: cell.y });
      if (isLastItem) {
        window.setTimeout(() => showInventorySlot(slot.slotIndex), 120);
      }
      feedback.pulseBoardCell(cellKey(cell.x, cell.y));
    } catch (error) {
      showInventorySlot(slot.slotIndex);
      feedback.flashInventorySlot(slot.slotIndex, "error");
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
          nowMs={nowMs}
          onEmptyDoubleActivate={setBuildCell}
          onTileDoubleActivate={(item) => {
            if (!item.producer) {
              void stashWithFly(item);
              return;
            }

            if (item.producer.trigger === "auto") {
              togglePause.mutate({ boardItemId: item.id }, { onError: feedback.showError });
              return;
            }

            const activation = shouldExhaustOnDoubleActivate(item.itemId) ? "exhaust" : "single";
            void produceFrom(item, activation);
          }}
          onTogglePause={(item) => togglePause.mutate({ boardItemId: item.id }, { onError: feedback.showError })}
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
        onSlotDoubleActivate={placeInventoryFromDoubleTap}
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

function shouldExhaustOnDoubleActivate(itemId: string) {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  return producer?.doubleClickBehavior === "exhaust";
}
