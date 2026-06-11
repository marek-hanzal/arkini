import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import type { GameView } from "@arkini/db";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { match } from "ts-pattern";
import { DbStatusCard } from "~/components/DbStatusCard";
import { useGameAction, useGameView } from "~/hooks/useGameView";

type Selection = { type: "board"; boardItemId: string } | null;

type DragData =
  | { type: "inventory"; slotIndex: number }
  | { type: "board"; boardItemId: string }
  | { type: "build"; recipeId: string };

type DropData =
  | { type: "board-cell"; x: number; y: number; boardItemId?: string }
  | { type: "inventory-slot"; slotIndex: number };

type DropState = "neutral" | "valid" | "invalid";

type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Flyout = {
  id: number;
  itemId: string;
  from: RectSnapshot;
  to: RectSnapshot;
};

const cellClass = "h-20 w-20 shrink-0 rounded-xl border p-1.5 transition";
const stashAnimationMs = 240;

export function GameShell() {
  const game = useGameView();
  const [selection, setSelection] = useState<Selection>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);
  const [committedDrag, setCommittedDrag] = useState<DragData | null>(null);
  const [invalidTargetId, setInvalidTargetId] = useState<string | null>(null);
  const [inventoryPulseSlot, setInventoryPulseSlot] = useState<number | null>(null);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 150);
    return () => window.clearInterval(interval);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const placeInventory = useGameAction((db, input: { slotIndex: number; x: number; y: number }) =>
    db.placeInventoryItem(input.slotIndex, input.x, input.y),
  );
  const moveBoard = useGameAction((db, input: { boardItemId: string; x: number; y: number }) =>
    db.moveBoardItem(input.boardItemId, input.x, input.y),
  );
  const stashBoard = useGameAction((db, input: { boardItemId: string; slotIndex?: number }) =>
    db.stashBoardItem(input.boardItemId, input.slotIndex),
  );
  const mergeBoard = useGameAction((db, input: { sourceBoardItemId: string; targetBoardItemId: string }) =>
    db.mergeBoardItems(input.sourceBoardItemId, input.targetBoardItemId),
  );
  const produce = useGameAction((db, input: { boardItemId: string }) => db.produceBoardItem(input.boardItemId));
  const build = useGameAction((db, input: { recipeId: string; x: number; y: number }) =>
    db.buildRecipe(input.recipeId, input.x, input.y),
  );
  const reset = useGameAction((db) => db.resetDefaultSaveGame());

  const pending =
    placeInventory.isPending ||
    moveBoard.isPending ||
    stashBoard.isPending ||
    mergeBoard.isPending ||
    produce.isPending ||
    build.isPending ||
    reset.isPending ||
    flyout !== null;

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

  async function runAction(action: () => Promise<unknown>, invalidId?: string) {
    try {
      await action();
      setSelection(null);
    } catch (error) {
      markInvalid(invalidId);
      toast.error(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function runDrop(action: () => Promise<unknown>, source: DragData, invalidId?: string, onSuccess?: () => void) {
    setCommittedDrag(source);
    try {
      await action();
      onSuccess?.();
      setSelection(null);
    } catch (error) {
      markInvalid(invalidId);
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setCommittedDrag(null);
    }
  }

  async function stashWithFlyout(boardItemId: string, itemId: string) {
    if (!game.data) return;

    const targetSlotIndex = resolveInventoryDestination(game.data, itemId);
    if (targetSlotIndex === null) {
      markInvalid(boardItemId);
      toast.error("Inventory is full.");
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
      markInvalid(boardItemId);
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setFlyout(null);
      setCommittedDrag(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag(event.active.data.current as DragData | null);
    setActiveOverId(null);
  }

  function handleDragOver(event: DragOverEvent) {
    setActiveOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
    setActiveOverId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    const overId = event.over ? String(event.over.id) : undefined;
    setActiveDrag(null);
    setActiveOverId(null);

    if (!active || !over || !game.data) {
      markInvalid(overId ?? String(event.active.id));
      return;
    }

    void match([active, over] as const)
      .with([{ type: "inventory" }, { type: "board-cell" }], ([source, target]) => {
        if (target.boardItemId) {
          markInvalid(overId);
          return;
        }
        void runDrop(() => placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y }), active, overId);
      })
      .with([{ type: "build" }, { type: "board-cell" }], ([source, target]) => {
        if (target.boardItemId) {
          markInvalid(overId);
          return;
        }
        void runDrop(() => build.mutateAsync({ recipeId: source.recipeId, x: target.x, y: target.y }), active, overId);
      })
      .with([{ type: "board" }, { type: "board-cell" }], ([source, target]) => {
        if (source.boardItemId === target.boardItemId) return;

        const targetBoardItemId = target.boardItemId;
        if (targetBoardItemId) {
          if (!canMergeBoardItems(game.data, source.boardItemId, targetBoardItemId)) {
            markInvalid(overId);
            toast.error("These items cannot merge.");
            return;
          }

          void runDrop(
            () => mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId }),
            active,
            overId,
          );
          return;
        }

        void runDrop(() => moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y }), active, overId);
      })
      .with([{ type: "board" }, { type: "inventory-slot" }], ([source, target]) => {
        const boardItem = game.data.boardItems.find((item) => item.id === source.boardItemId);
        if (!boardItem) {
          markInvalid(overId);
          return;
        }

        const targetSlotIndex = resolveInventoryDestination(game.data, boardItem.itemId, target.slotIndex);
        if (targetSlotIndex === null) {
          markInvalid(overId);
          toast.error("Inventory is full.");
          return;
        }

        void runDrop(
          () => stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: targetSlotIndex }),
          active,
          `inventory:${targetSlotIndex}`,
          () => pulseInventory(targetSlotIndex),
        );
      })
      .otherwise(() => {
        markInvalid(overId);
      });
  }

  if (game.isLoading) {
    return <GameCard title="Loading game">Opening the local OPFS SQLite database.</GameCard>;
  }

  if (game.isError) {
    return <GameCard title="Game failed">{(game.error as Error).message}</GameCard>;
  }

  if (!game.data) return null;

  const inventoryPreviewSlot = getInventoryPreviewSlot(game.data, activeDrag, activeOverId);

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
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <section className="grid w-fit max-w-full gap-4 xl:grid-cols-[auto_20rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <GameBoard
              game={game.data}
              selection={selection}
              activeDrag={activeDrag}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              nowMs={nowMs}
              onSelect={setSelection}
              onProduce={(boardItemId) => runAction(() => produce.mutateAsync({ boardItemId }), boardItemId)}
              onStash={stashWithFlyout}
            />
            <InventoryPanel
              game={game.data}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              previewSlotIndex={inventoryPreviewSlot}
              pulseSlotIndex={inventoryPulseSlot}
            />
          </div>

          <aside className="flex flex-col gap-4">
            <ActionPanel
              game={game.data}
              selection={selection}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              onReset={() => runAction(() => reset.mutateAsync(undefined))}
            />
            <DbStatusCard />
          </aside>
        </section>
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeDrag ? <DragPreview game={game.data} drag={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>
      {flyout ? <FlyoutTile game={game.data} flyout={flyout} /> : null}
    </>
  );
}

function GameBoard({
  game,
  selection,
  activeDrag,
  pending,
  invalidTargetId,
  committedDrag,
  nowMs,
  onSelect,
  onProduce,
  onStash,
}: Readonly<{
  game: GameView;
  selection: Selection;
  activeDrag: DragData | null;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  nowMs: number;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
}>) {
  const itemByCell = useMemo(
    () => new Map(game.boardItems.map((item) => [`${item.x}:${item.y}`, item])),
    [game.boardItems],
  );
  const cells = Array.from({ length: game.save.boardWidth * game.save.boardHeight }, (_, index) => ({
    x: index % game.save.boardWidth,
    y: Math.floor(index / game.save.boardWidth),
  }));

  return (
    <section className="w-fit max-w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Board</p>
          <h2 className="text-base font-semibold text-white">Merge space</h2>
        </div>
        <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400">
          {game.save.boardWidth}×{game.save.boardHeight}, 1×1
        </p>
      </div>

      <div className="mt-4 max-w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/30 p-2">
        <div className="grid w-fit gap-1.5" style={{ gridTemplateColumns: `repeat(${game.save.boardWidth}, 5rem)` }}>
          {cells.map((cell) => {
            const boardItem = itemByCell.get(`${cell.x}:${cell.y}`);
            return (
              <BoardCell
                key={`${cell.x}:${cell.y}`}
                game={game}
                x={cell.x}
                y={cell.y}
                boardItem={boardItem ?? null}
                selected={selection?.type === "board" && selection.boardItemId === boardItem?.id}
                activeDrag={activeDrag}
                pending={pending}
                invalidTargetId={invalidTargetId}
                committedDrag={committedDrag}
                nowMs={nowMs}
                onSelect={onSelect}
                onProduce={onProduce}
                onStash={onStash}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BoardCell({
  game,
  x,
  y,
  boardItem,
  selected,
  activeDrag,
  pending,
  invalidTargetId,
  committedDrag,
  nowMs,
  onSelect,
  onProduce,
  onStash,
}: Readonly<{
  game: GameView;
  x: number;
  y: number;
  boardItem: GameView["boardItems"][number] | null;
  selected: boolean;
  activeDrag: DragData | null;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  nowMs: number;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
}>) {
  const dropId = `board:${x}:${y}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "board-cell", x, y, boardItemId: boardItem?.id } satisfies DropData,
    disabled: pending,
  });
  const sourceCommitted = committedDrag?.type === "board" && committedDrag.boardItemId === boardItem?.id;
  const visibleBoardItem = sourceCommitted ? null : boardItem;
  const invalid = invalidTargetId === dropId || invalidTargetId === boardItem?.id;
  const item = visibleBoardItem ? game.items[visibleBoardItem.itemId] : null;
  const dropState = isOver ? getBoardCellDropState(game, activeDrag, boardItem) : "neutral";

  return (
    <div
      ref={setNodeRef}
      className={[
        cellClass,
        "bg-slate-950/80 shadow-inner shadow-black/30",
        invalid
          ? "border-red-300 bg-red-950/40"
          : dropState === "valid"
            ? "border-emerald-300 bg-emerald-950/40"
            : dropState === "invalid"
              ? "border-red-300 bg-red-950/40"
              : "border-slate-800",
      ].join(" ")}
    >
      {visibleBoardItem && item ? (
        <BoardItemCard
          item={item}
          boardItem={visibleBoardItem}
          selected={selected}
          pending={pending}
          nowMs={nowMs}
          onSelect={() => onSelect(selected ? null : { type: "board", boardItemId: visibleBoardItem.id })}
          onProduce={() => onProduce(visibleBoardItem.id)}
          onStash={() => onStash(visibleBoardItem.id, visibleBoardItem.itemId)}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[0.6rem] text-slate-700">
          {x},{y}
        </div>
      )}
    </div>
  );
}

function BoardItemCard({
  item,
  boardItem,
  selected,
  pending,
  nowMs,
  onSelect,
  onProduce,
  onStash,
}: Readonly<{
  item: GameView["items"][string];
  boardItem: GameView["boardItems"][number];
  selected: boolean;
  pending: boolean;
  nowMs: number;
  onSelect(): void;
  onProduce(): void;
  onStash(): void;
}>) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `board-item:${boardItem.id}`,
    data: { type: "board", boardItemId: boardItem.id } satisfies DragData,
    disabled: pending,
  });
  const cooldown = getCooldown(item, boardItem, nowMs);

  function handleDoubleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (item.canProduce) {
      onProduce();
      return;
    }

    onStash();
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={pending}
      data-board-item-id={boardItem.id}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      className={[
        "relative flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 overflow-hidden rounded-lg text-center transition active:cursor-grabbing disabled:cursor-not-allowed",
        selected ? "bg-emerald-500/15 ring-1 ring-emerald-300" : "hover:bg-slate-800/70",
        isDragging ? "opacity-0" : "opacity-100",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      {cooldown.coolingDown ? (
        <div
          className="absolute inset-x-0 bottom-0 bg-amber-400/15 transition-[height] duration-150"
          style={{ height: `${Math.round(cooldown.progress * 100)}%` }}
        />
      ) : null}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-1">
        <TileContent item={item} />
        {cooldown.coolingDown ? (
          <span className="absolute right-0.5 top-0.5 rounded-full bg-slate-950/90 px-1.5 text-[0.58rem] font-bold text-amber-100">
            {Math.ceil(cooldown.remainingMs / 1000)}s
          </span>
        ) : null}
      </div>
    </button>
  );
}

function InventoryPanel({
  game,
  pending,
  invalidTargetId,
  committedDrag,
  previewSlotIndex,
  pulseSlotIndex,
}: Readonly<{
  game: GameView;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  previewSlotIndex: number | null;
  pulseSlotIndex: number | null;
}>) {
  const columns = game.save.boardWidth;

  return (
    <section className="w-fit max-w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">Inventory</p>
          <h2 className="text-base font-semibold text-white">Stack storage</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">{game.inventory.length} slots</p>
      </div>
      <div className="mt-4 max-w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/30 p-2">
        <div className="grid w-fit gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 5rem)` }}>
          {game.inventory.map((slot) => (
            <InventorySlotCell
              key={slot.slotIndex}
              game={game}
              slot={slot}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              preview={previewSlotIndex === slot.slotIndex}
              pulse={pulseSlotIndex === slot.slotIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function InventorySlotCell({
  game,
  slot,
  pending,
  invalidTargetId,
  committedDrag,
  preview,
  pulse,
}: Readonly<{
  game: GameView;
  slot: GameView["inventory"][number];
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  preview: boolean;
  pulse: boolean;
}>) {
  const dropId = `inventory:${slot.slotIndex}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData,
    disabled: pending,
  });
  const sourceCommitted = committedDrag?.type === "inventory" && committedDrag.slotIndex === slot.slotIndex;
  const visibleStack = sourceCommitted ? null : slot.stack;
  const item = visibleStack ? game.items[visibleStack.itemId] : null;
  const invalid = invalidTargetId === dropId;

  return (
    <div
      ref={setNodeRef}
      data-inventory-slot-index={slot.slotIndex}
      className={[
        cellClass,
        "relative bg-slate-950/80",
        invalid
          ? "border-red-300 bg-red-950/40"
          : pulse
            ? "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50"
            : preview
              ? "border-sky-300 bg-sky-950/40"
              : isOver
                ? "border-slate-500 bg-slate-900/60"
                : "border-slate-800",
      ].join(" ")}
    >
      {item && visibleStack ? (
        <InventoryItemCard item={item} quantity={visibleStack.quantity} slotIndex={slot.slotIndex} pending={pending} />
      ) : null}
    </div>
  );
}

function InventoryItemCard({
  item,
  quantity,
  slotIndex,
  pending,
}: Readonly<{
  item: GameView["items"][string];
  quantity: number;
  slotIndex: number;
  pending: boolean;
}>) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `inventory-item:${slotIndex}`,
    data: { type: "inventory", slotIndex } satisfies DragData,
    disabled: pending,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 rounded-lg transition active:cursor-grabbing",
        isDragging ? "opacity-0" : "hover:bg-slate-800/70",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      <TileContent item={item} />
      <span className="absolute bottom-1 right-1.5 rounded-full bg-slate-900 px-1.5 text-[0.65rem] font-bold text-slate-100">
        {quantity}
      </span>
    </div>
  );
}

function ActionPanel({
  game,
  selection,
  pending,
  invalidTargetId,
  committedDrag,
  onReset,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  onReset(): void;
}>) {
  const selectedBoardItem = selection?.type === "board" ? game.boardItems.find((item) => item.id === selection.boardItemId) : null;
  const selectedItem = selectedBoardItem ? game.items[selectedBoardItem.itemId] : null;
  const invalidSelection = selectedBoardItem ? invalidTargetId === selectedBoardItem.id : false;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Actions</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Drag-first controls</h2>
      <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">
        Drag inventory items onto empty board cells. Drag board items onto empty cells to move, matching merge targets to combine, or the inventory to store.
      </p>

      {selectedItem && selectedBoardItem ? (
        <div
          className={[
            "mt-4 rounded-2xl border bg-slate-950/70 p-4 transition",
            invalidSelection ? "border-red-300 bg-red-950/30" : "border-slate-800",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <img src={selectedItem.assetSrc} alt="" className="h-12 w-12" />
            <div>
              <p className="font-semibold text-white">{selectedItem.name}</p>
              <p className="text-xs text-slate-400">{selectedItem.description}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Double-click producers to drop items. Double-click regular board items to send them to the first matching inventory stack.
          </p>
        </div>
      ) : null}

      <BuildPanel game={game} pending={pending} committedDrag={committedDrag} />

      <button
        type="button"
        disabled={pending}
        onClick={onReset}
        className="mt-4 w-full rounded-2xl border border-red-400/30 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-50"
      >
        Reset save
      </button>
    </section>
  );
}

function BuildPanel({
  game,
  pending,
  committedDrag,
}: Readonly<{
  game: GameView;
  pending: boolean;
  committedDrag: DragData | null;
}>) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-white">Blueprint builds</p>
      <div className="mt-3 grid gap-3">
        {game.buildRecipes.map((recipe) => (
          <BuildRecipeCard key={recipe.id} game={game} recipe={recipe} pending={pending} committedDrag={committedDrag} />
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Drag a build card onto an empty board cell. Crafting consumes the blueprint and inventory materials.</p>
    </div>
  );
}

function BuildRecipeCard({
  game,
  recipe,
  pending,
  committedDrag,
}: Readonly<{
  game: GameView;
  recipe: GameView["buildRecipes"][number];
  pending: boolean;
  committedDrag: DragData | null;
}>) {
  const result = game.items[recipe.resultItemId];
  const blueprint = game.items[recipe.blueprintItemId];
  const hidden = committedDrag?.type === "build" && committedDrag.recipeId === recipe.id;
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `build:${recipe.id}`,
    data: { type: "build", recipeId: recipe.id } satisfies DragData,
    disabled: pending || !recipe.canBuild,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "rounded-2xl border p-3 text-left transition",
        recipe.canBuild ? "cursor-grab border-slate-800 bg-slate-900/60 hover:border-amber-300 active:cursor-grabbing" : "border-slate-800 bg-slate-950/40 opacity-40",
        hidden || isDragging ? "opacity-0" : "",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-3">
        <img src={result.assetSrc} alt="" className="h-10 w-10" />
        <div>
          <p className="font-semibold text-slate-100">Build {result.name}</p>
          <p className="text-xs text-slate-400">Consumes {blueprint.name}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {recipe.costs.map((cost) => `${game.items[cost.itemId].name} × ${cost.quantity}`).join(", ")}
      </p>
    </div>
  );
}

function DragPreview({ game, drag }: Readonly<{ game: GameView; drag: DragData }>) {
  const item = match(drag)
    .with({ type: "inventory" }, ({ slotIndex }) => {
      const stack = game.inventory.find((slot) => slot.slotIndex === slotIndex)?.stack;
      return stack ? game.items[stack.itemId] : null;
    })
    .with({ type: "board" }, ({ boardItemId }) => {
      const boardItem = game.boardItems.find((candidate) => candidate.id === boardItemId);
      return boardItem ? game.items[boardItem.itemId] : null;
    })
    .with({ type: "build" }, ({ recipeId }) => {
      const recipe = game.buildRecipes.find((candidate) => candidate.id === recipeId);
      return recipe ? game.items[recipe.resultItemId] : null;
    })
    .exhaustive();

  if (!item) return null;

  return (
    <div className="h-20 w-20 rounded-xl border border-emerald-300 bg-slate-950/95 p-1.5 shadow-2xl shadow-slate-950/80">
      <TileContent item={item} />
    </div>
  );
}

function FlyoutTile({ game, flyout }: Readonly<{ game: GameView; flyout: Flyout }>) {
  const [arrived, setArrived] = useState(false);
  const item = game.items[flyout.itemId];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setArrived(true));
    return () => window.cancelAnimationFrame(frame);
  }, [flyout.id]);

  if (!item) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-sky-300 bg-slate-950/95 p-1.5 shadow-2xl shadow-slate-950/80"
      style={{
        left: flyout.from.left,
        top: flyout.from.top,
        width: flyout.from.width,
        height: flyout.from.height,
        opacity: arrived ? 0.15 : 1,
        transform: arrived
          ? `translate(${flyout.to.left - flyout.from.left}px, ${flyout.to.top - flyout.from.top}px) scale(0.72)`
          : "translate(0, 0) scale(1)",
        transition: `transform ${stashAnimationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${stashAnimationMs}ms ease`,
      }}
    >
      <TileContent item={item} />
    </div>
  );
}

function TileContent({ item }: Readonly<{ item: GameView["items"][string] }>) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
      <img src={item.assetSrc} alt="" className="h-8 w-8" />
      <span className="line-clamp-1 max-w-full text-[0.58rem] font-medium leading-tight text-slate-200">{item.name}</span>
    </div>
  );
}

function GameCard({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Arkini</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-slate-300">{children}</p>
    </section>
  );
}

function getBoardCellDropState(game: GameView, activeDrag: DragData | null, target: GameView["boardItems"][number] | null): DropState {
  if (!activeDrag) return "neutral";

  return match(activeDrag)
    .with({ type: "inventory" }, () => (target ? "invalid" : "valid") as DropState)
    .with({ type: "build" }, () => (target ? "invalid" : "valid") as DropState)
    .with({ type: "board" }, ({ boardItemId }) => {
      if (!target) return "valid";
      if (target.id === boardItemId) return "neutral";
      return canMergeBoardItems(game, boardItemId, target.id) ? "valid" : "invalid";
    })
    .exhaustive();
}

function canMergeBoardItems(game: GameView, sourceBoardItemId: string, targetBoardItemId: string) {
  if (sourceBoardItemId === targetBoardItemId) return false;
  const source = game.boardItems.find((item) => item.id === sourceBoardItemId);
  const target = game.boardItems.find((item) => item.id === targetBoardItemId);
  if (!source || !target) return false;
  return source.itemId === target.itemId && game.items[source.itemId]?.canMerge === true;
}

function getInventoryPreviewSlot(game: GameView, activeDrag: DragData | null, activeOverId: string | null) {
  if (!activeDrag || activeDrag.type !== "board" || !activeOverId?.startsWith("inventory:")) return null;
  const boardItem = game.boardItems.find((item) => item.id === activeDrag.boardItemId);
  if (!boardItem) return null;
  const preferredSlotIndex = Number(activeOverId.replace("inventory:", ""));
  return resolveInventoryDestination(game, boardItem.itemId, preferredSlotIndex);
}

function resolveInventoryDestination(game: GameView, itemId: string, preferredSlotIndex?: number) {
  const item = game.items[itemId];
  if (!item) return null;

  const existingStack = game.inventory.find((slot) => slot.stack?.itemId === itemId && slot.stack.quantity < item.maxStackSize);
  if (existingStack) return existingStack.slotIndex;

  if (preferredSlotIndex !== undefined) {
    const preferredSlot = game.inventory.find((slot) => slot.slotIndex === preferredSlotIndex);
    if (preferredSlot && !preferredSlot.stack) return preferredSlot.slotIndex;
  }

  return game.inventory.find((slot) => !slot.stack)?.slotIndex ?? null;
}

function getCooldown(item: GameView["items"][string], boardItem: GameView["boardItems"][number], nowMs: number) {
  const cooldownUntil = boardItem.state.producer?.cooldownUntil;
  const cooldownMs = item.producerCooldownMs ?? 0;
  if (!cooldownUntil || cooldownMs <= 0) {
    return { coolingDown: false, progress: 1, remainingMs: 0 };
  }

  const remainingMs = Math.max(0, Date.parse(cooldownUntil) - nowMs);
  if (remainingMs <= 0) {
    return { coolingDown: false, progress: 1, remainingMs: 0 };
  }

  return {
    coolingDown: true,
    progress: Math.max(0, Math.min(1, 1 - remainingMs / cooldownMs)),
    remainingMs,
  };
}

function snapshotRect(rect: DOMRect): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
