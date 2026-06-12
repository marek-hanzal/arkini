import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import type { BuildRecipeId } from "~/domains/game-data";
import type { BoardViewItem, GameView, InventorySlot, ProducerDropResult } from "~/domains/database";
import { useGameAction, useGameDataInvalidation, useGameView } from "~/hooks/useGameView";
import { Board } from "./components/Board";
import { BuildSheet } from "./components/BuildSheet";
import { Flyer } from "./components/Flyer";
import { InventorySheet } from "./components/InventorySheet";
import { Tile } from "./components/Tile";
import { cellKey, cssEscape, inventorySinkRect, queryRect, tileVisualRect, wait } from "./helpers";
import { columns, flyMs, rows, type BuildCell, type DragData } from "./types";
import { useDraggableControl } from "./useDraggableControl";
import { useFlyers } from "./useFlyers";
import { useGameFeedback } from "./useGameFeedback";

export function GameShell() {
  const gameQuery = useGameView();
  const game = gameQuery.data;
  const invalidateGameData = useGameDataInvalidation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [buildCell, setBuildCell] = useState<BuildCell | null>(null);
  const { flyers, addFlyer } = useFlyers();
  const [nowMs, setNowMs] = useState(Date.now());
  const feedback = useGameFeedback();

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

  const drag = useDraggableControl({
    game,
    items: game?.items,
    actions: {
      placeInventory: (input) => placeInventory.mutateAsync(input),
      moveBoard: (input) => moveBoard.mutateAsync(input),
      stashBoard: (input) => stashBoard.mutateAsync(input),
      swapInventory: (input) => swapInventory.mutateAsync(input),
      mergeBoard: (input) => mergeBoard.mutateAsync(input),
    },
    feedback: {
      pulseBoardCell: feedback.pulseBoardCell,
      pulseMergeCell: feedback.pulseMergeCell,
      pulseInventorySlot: feedback.pulseInventorySlot,
      flashInvalidTarget: feedback.flashInvalidTarget,
      showError: feedback.showError,
    },
    addFlyer,
  });

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

  async function stashBoardWithFly(boardItem: BoardViewItem) {
    const source: DragData = { kind: "board", boardItemId: boardItem.id, itemId: boardItem.itemId };
    const sourceRect = queryRect(`[data-board-item-id="${cssEscape(boardItem.id)}"]`)
      ?? queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`);
    const from = sourceRect ? tileVisualRect(sourceRect) : null;

    try {
      if (from) {
        drag.commitSource(source, true);
        addFlyer(boardItem.itemId, from, inventorySinkRect(from), "stash");
      }

      await stashBoard.mutateAsync({ boardItemId: boardItem.id });
      if (game?.firstEmptyInventorySlotIndex !== null && game?.firstEmptyInventorySlotIndex !== undefined) {
        feedback.pulseInventorySlot(game.firstEmptyInventorySlotIndex);
      }
      if (from) await wait(flyMs);
    } catch (error) {
      feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
      feedback.showError(error);
    } finally {
      drag.clearCommittedDrag();
    }
  }

  async function placeInventoryOnBoardWithFly(slot: InventorySlot) {
    const stack = slot.stack;
    const target = game ? findFirstEmptyBoardCell(game) : null;

    if (!stack || !target) {
      feedback.flashInventorySlot(slot.slotIndex, "error");
      return;
    }

    const source: DragData = { kind: "inventory", slotIndex: slot.slotIndex, itemId: stack.itemId, quantity: stack.quantity };
    const sourceRect = queryRect(`[data-inventory-slot="${slot.slotIndex}"]`);
    const targetRect = queryRect(`[data-board-cell="${target.x}:${target.y}"]`);
    const from = sourceRect ? tileVisualRect(sourceRect) : null;
    const to = targetRect ? tileVisualRect(targetRect) : null;

    try {
      if (from && to) {
        drag.commitSource(source, stack.quantity <= 1);
        addFlyer(stack.itemId, from, to);
        await wait(flyMs);
      }

      await placeInventory.mutateAsync({ slotIndex: slot.slotIndex, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
    } catch (error) {
      feedback.flashInventorySlot(slot.slotIndex, "error");
      feedback.showError(error);
    } finally {
      drag.clearCommittedDrag();
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

  if (gameQuery.isPending) {
    return <div className="grid h-[70vh] w-[min(100vw-1.5rem,430px)] place-items-center text-sm text-slate-400">Booting SQLite…</div>;
  }

  if (gameQuery.isError || !game) {
    return <div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">{(gameQuery.error as Error)?.message ?? "Game failed to load."}</div>;
  }

  return (
    <DndContext {...drag.contextProps}>
      <section className="relative flex w-[min(100vw-1.5rem,430px)] flex-col gap-3 pb-3">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">Arkini</p>
          <h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
        </div>

        <Board
          game={game}
          activeDrag={drag.activeDrag}
          committedDrag={drag.committedDrag}
          hiddenBoardIds={drag.hiddenBoardIds}
          invalidBoardCellKey={feedback.invalidBoardCellKey}
          pulsedBoardCellKey={feedback.pulsedBoardCellKey}
          mergedBoardCellKey={feedback.mergedBoardCellKey}
          nowMs={nowMs}
          onEmptyDoubleActivate={setBuildCell}
          onTileSingleActivate={(item) => {
            if (!item.producer) return;
            void produceFrom(item, "single");
          }}
          onTileDoubleActivate={(item) => {
            void stashBoardWithFly(item);
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
        hiddenInventorySlots={drag.hiddenInventorySlots}
        committedDrag={drag.committedDrag}
        activeDrag={drag.activeDrag}
        invalidInventorySlot={feedback.invalidInventorySlot}
        pulsedInventorySlot={feedback.pulsedInventorySlot}
        onOpenChange={setSheetOpen}
        onSlotDoubleActivate={(slot) => {
          void placeInventoryOnBoardWithFly(slot);
        }}
      />

      {flyers.map((flyer) => <Flyer key={flyer.id} flyer={flyer} item={game.items[flyer.itemId]} />)}

      <DragOverlay dropAnimation={null}>
        {drag.activeItem ? (
          <Tile
            item={drag.activeItem}
            dragOverlay
            quantity={drag.activeDrag?.kind === "inventory" ? 1 : undefined}
            overlaySize={drag.dragPreviewRect}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function findFirstEmptyBoardCell(game: GameView): BuildCell | null {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!game.boardItemByCellKey[cellKey(x, y)]) return { x, y };
    }
  }

  return null;
}
