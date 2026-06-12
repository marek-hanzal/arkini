import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { DbStatusCard } from "~/components/DbStatusCard";
import type { BuildRecipeId } from "~/domains/game-data";
import type { BoardViewItem, GameView, InventorySlot, ProducerDropResult } from "~/domains/database";
import { useGameAction, useGameDataInvalidation, useGameView } from "~/hooks/useGameView";
import { cn } from "~/lib/cn";
import { Board } from "./components/Board";
import { BottomSheet } from "./components/BottomSheet";
import { BuildSheet } from "./components/BuildSheet";
import { Flyer } from "./components/Flyer";
import { InventorySheet } from "./components/InventorySheet";
import { Tile } from "./components/Tile";
import { cellKey, cssEscape, inventorySinkRect, queryRect, tileVisualRect, wait } from "./helpers";
import {
  boardCellNodeId,
  boardSourceId,
  columns,
  flyMs,
  inventorySlotNodeId,
  inventorySourceId,
  rows,
  type BuildCell,
  type GameDragData,
} from "./types";
import { useFlyers } from "./useFlyers";
import { useGameDraggableControl } from "./useGameDraggableControl";
import { useGameFeedback } from "./useGameFeedback";

type ActiveSheet = "inventory" | "database" | "build" | null;

export function GameShell() {
  const gameQuery = useGameView();
  const game = gameQuery.data;
  const invalidateGameData = useGameDataInvalidation();
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [renderedSheet, setRenderedSheet] = useState<Exclude<ActiveSheet, null>>("inventory");
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

  const drag = useGameDraggableControl({
    game,
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
      flashBoardCell: feedback.flashBoardCell,
      flashInventorySlot: feedback.flashInventorySlot,
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

  function closeSheet() {
    setActiveSheet(null);
  }

  function openSheet(sheet: Exclude<ActiveSheet, null>) {
    setRenderedSheet(sheet);
    setActiveSheet((current) => (current === sheet ? null : sheet));
    if (sheet !== "build") setBuildCell(null);
  }

  function openBuild(cell: BuildCell) {
    setBuildCell(cell);
    setRenderedSheet("build");
    setActiveSheet("build");
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

  async function stashBoardWithFly(boardItem: BoardViewItem) {
    const source: GameDragData = {
      sourceId: boardSourceId(boardItem.id),
      sourceNodeId: boardCellNodeId(boardItem.x, boardItem.y),
      itemId: boardItem.itemId,
      source: { kind: "board", boardItemId: boardItem.id },
      hideWhenActive: true,
    };
    const sourceRect = queryRect(`[data-board-item-id="${cssEscape(boardItem.id)}"]`)
      ?? queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`);
    const from = sourceRect ? tileVisualRect(sourceRect) : null;

    try {
      if (from) {
        drag.hideSources([source.sourceId]);
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
      drag.clearHiddenSources();
    }
  }

  async function placeInventoryOnBoardWithFly(slot: InventorySlot) {
    const stack = slot.stack;
    const target = game ? findFirstEmptyBoardCell(game) : null;

    if (!stack || !target) {
      feedback.flashInventorySlot(slot.slotIndex, "error");
      return;
    }

    const source: GameDragData = {
      sourceId: inventorySourceId(slot.slotIndex),
      sourceNodeId: inventorySlotNodeId(slot.slotIndex),
      itemId: stack.itemId,
      source: { kind: "inventory", slotIndex: slot.slotIndex, quantity: stack.quantity },
      overlay: { quantity: stack.quantity },
      hideWhenActive: stack.quantity <= 1,
    };
    const sourceRect = queryRect(`[data-inventory-slot="${slot.slotIndex}"]`);
    const targetRect = queryRect(`[data-board-cell="${target.x}:${target.y}"]`);
    const from = sourceRect ? tileVisualRect(sourceRect) : null;
    const to = targetRect ? tileVisualRect(targetRect) : null;

    try {
      if (from && to) {
        if (source.hideWhenActive !== false) drag.hideSources([source.sourceId]);
        addFlyer(stack.itemId, from, to, "place");
        await wait(flyMs);
      }

      await placeInventory.mutateAsync({ slotIndex: slot.slotIndex, x: target.x, y: target.y });
      feedback.pulseBoardCell(cellKey(target.x, target.y));
    } catch (error) {
      feedback.flashInventorySlot(slot.slotIndex, "error");
      feedback.showError(error);
    } finally {
      drag.clearHiddenSources();
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
          : activeSheet === "inventory" ? queryRect(`[data-inventory-slot="${placement.slotIndex}"]`) : null;

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
    return <div className="grid h-dvh w-dvw place-items-center text-sm text-slate-400">Booting SQLite…</div>;
  }

  if (gameQuery.isError || !game) {
    return <div className="grid h-dvh w-dvw place-items-center p-4"><div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">{(gameQuery.error as Error)?.message ?? "Game failed to load."}</div></div>;
  }

  return (
    <DndContext {...drag.contextProps}>
      <div className="relative h-dvh w-dvw overflow-hidden px-3 pt-3 pb-[calc(var(--ak-bottom-nav-height)+0.75rem)]">
        <main className="mx-auto flex h-full ak-game-width min-h-0 flex-col gap-3 overflow-hidden">
          <div className="shrink-0 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">Arkini</p>
            <h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
          </div>

          <div className="min-h-0 shrink-0">
            <Board
              game={game}
              activeDrag={drag.activeDrag}
              isSourceHidden={drag.isSourceHidden}
              invalidBoardCellKey={feedback.invalidBoardCellKey}
              pulsedBoardCellKey={feedback.pulsedBoardCellKey}
              mergedBoardCellKey={feedback.mergedBoardCellKey}
              nowMs={nowMs}
              onEmptyDoubleActivate={openBuild}
              onTileSingleActivate={(item) => {
                if (!item.producer) return;
                void produceFrom(item, "single");
              }}
              onTileDoubleActivate={(item) => {
                void stashBoardWithFly(item);
              }}
            />
          </div>
        </main>

        <BottomNavigation activeSheet={activeSheet} onOpen={openSheet} />
      </div>

      <BottomSheet open={activeSheet !== null} onClose={closeSheet}>
        <div className="min-h-0">
          <section className={cn("min-h-0", renderedSheet !== "inventory" && "hidden")} aria-hidden={activeSheet !== "inventory"}>
            <InventorySheet
              game={game}
              isSourceHidden={drag.isSourceHidden}
              invalidInventorySlot={feedback.invalidInventorySlot}
              pulsedInventorySlot={feedback.pulsedInventorySlot}
              onClose={closeSheet}
              onSlotDoubleActivate={(slot) => {
                void placeInventoryOnBoardWithFly(slot);
              }}
            />
          </section>

          <section className={cn("max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain p-4", renderedSheet !== "database" && "hidden")} aria-hidden={activeSheet !== "database"}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.62rem] uppercase tracking-[0.22em] text-emerald-300">System</p>
                <p className="text-sm text-slate-300">Local database</p>
              </div>
              <button type="button" className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300" onClick={closeSheet}>Close</button>
            </div>
            <DbStatusCard />
          </section>

          <section className={cn("max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain", renderedSheet !== "build" && "hidden")} aria-hidden={activeSheet !== "build"}>
            <BuildSheet
              game={game}
              cell={buildCell}
              onClose={closeSheet}
              onBuild={(recipeId) => {
                if (!buildCell) return;
                build.mutate(
                  { recipeId, x: buildCell.x, y: buildCell.y },
                  {
                    onSuccess: () => {
                      feedback.pulseBoardCell(cellKey(buildCell.x, buildCell.y));
                      closeSheet();
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
        </div>
      </BottomSheet>

      {flyers.map((flyer) => <Flyer key={flyer.id} flyer={flyer} item={game.items[flyer.itemId]} />)}

      <DragOverlay dropAnimation={null}>
        {drag.activeItem ? (
          <Tile
            item={drag.activeItem}
            dragOverlay
            quantity={drag.activeDrag?.overlay?.quantity && drag.activeDrag.overlay.quantity > 1 ? 1 : undefined}
            overlaySize={drag.dragPreviewRect}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BottomNavigation({ activeSheet, onOpen }: Readonly<{ activeSheet: ActiveSheet; onOpen(sheet: Exclude<ActiveSheet, null>): void }>) {
  return (
    <nav className="ak-bottom-nav" aria-label="Game panels">
      <div className="ak-bottom-nav-inner">
        <BottomNavButton active={activeSheet === "inventory"} label="Inventory" icon="▦" tone="inventory" onClick={() => onOpen("inventory")} />
        <BottomNavButton active={activeSheet === "database"} label="Database" icon="◈" tone="database" onClick={() => onOpen("database")} />
      </div>
    </nav>
  );
}

function BottomNavButton({ active, label, icon, tone, onClick }: Readonly<{ active: boolean; label: string; icon: string; tone: "inventory" | "database"; onClick(): void }>) {
  return (
    <button
      type="button"
      className="ak-bottom-nav-button"
      data-active={active ? "true" : "false"}
      data-tone={tone}
      onClick={onClick}
    >
      <span className="ak-bottom-nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
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
