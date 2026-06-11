import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { GameView } from "@arkini/db";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
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

const cellClass = "h-20 w-20 shrink-0 rounded-xl border p-1.5 transition";

export function GameShell() {
  const game = useGameView();
  const [selection, setSelection] = useState<Selection>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [committedDrag, setCommittedDrag] = useState<DragData | null>(null);
  const [invalidTargetId, setInvalidTargetId] = useState<string | null>(null);

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
  const stashBoard = useGameAction((db, input: { boardItemId: string; slotIndex: number }) =>
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
    reset.isPending;

  function markInvalid(targetId?: string) {
    if (!targetId) return;
    setInvalidTargetId(targetId);
    window.setTimeout(() => setInvalidTargetId(null), 650);
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

  async function runDrop(action: () => Promise<unknown>, source: DragData, invalidId?: string) {
    setCommittedDrag(source);
    try {
      await action();
      setSelection(null);
    } catch (error) {
      markInvalid(invalidId);
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setCommittedDrag(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag(event.active.data.current as DragData | null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    const overId = event.over ? String(event.over.id) : undefined;
    setActiveDrag(null);

    if (!active || !over) {
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
        void runDrop(() => stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: target.slotIndex }), active, overId);
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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <GameBoard
              game={game.data}
              selection={selection}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              onSelect={setSelection}
            />
            <InventoryPanel game={game.data} pending={pending} invalidTargetId={invalidTargetId} committedDrag={committedDrag} />
          </div>

          <aside className="flex flex-col gap-4">
            <ActionPanel
              game={game.data}
              selection={selection}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              onProduce={(boardItemId) => runAction(() => produce.mutateAsync({ boardItemId }), boardItemId)}
              onReset={() => runAction(() => reset.mutateAsync(undefined))}
            />
            <DbStatusCard />
          </aside>
        </section>
        <DragOverlay dropAnimation={null}>{activeDrag ? <DragPreview game={game.data} drag={activeDrag} /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function GameBoard({
  game,
  selection,
  pending,
  invalidTargetId,
  committedDrag,
  onSelect,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  onSelect(selection: Selection): void;
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
                pending={pending}
                invalidTargetId={invalidTargetId}
                committedDrag={committedDrag}
                onSelect={onSelect}
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
  pending,
  invalidTargetId,
  committedDrag,
  onSelect,
}: Readonly<{
  game: GameView;
  x: number;
  y: number;
  boardItem: GameView["boardItems"][number] | null;
  selected: boolean;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  onSelect(selection: Selection): void;
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

  return (
    <div
      ref={setNodeRef}
      className={[
        cellClass,
        "bg-slate-950/80 shadow-inner shadow-black/30",
        invalid ? "border-red-300 bg-red-950/40" : isOver ? "border-emerald-300 bg-emerald-950/40" : "border-slate-800",
      ].join(" ")}
    >
      {visibleBoardItem && item ? (
        <BoardItemCard
          item={item}
          boardItemId={visibleBoardItem.id}
          selected={selected}
          pending={pending}
          onSelect={() => onSelect(selected ? null : { type: "board", boardItemId: visibleBoardItem.id })}
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
  boardItemId,
  selected,
  pending,
  onSelect,
}: Readonly<{
  item: GameView["items"][string];
  boardItemId: string;
  selected: boolean;
  pending: boolean;
  onSelect(): void;
}>) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `board-item:${boardItemId}`,
    data: { type: "board", boardItemId } satisfies DragData,
    disabled: pending,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={pending}
      onClick={onSelect}
      className={[
        "flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 rounded-lg text-center transition active:cursor-grabbing disabled:cursor-not-allowed",
        selected ? "bg-emerald-500/15 ring-1 ring-emerald-300" : "hover:bg-slate-800/70",
        isDragging ? "opacity-0" : "opacity-100",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      <TileContent item={item} />
    </button>
  );
}

function InventoryPanel({
  game,
  pending,
  invalidTargetId,
  committedDrag,
}: Readonly<{
  game: GameView;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
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
}: Readonly<{
  game: GameView;
  slot: GameView["inventory"][number];
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
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
      className={[
        cellClass,
        "relative bg-slate-950/80",
        invalid ? "border-red-300 bg-red-950/40" : isOver ? "border-sky-300 bg-sky-950/40" : "border-slate-800",
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
  onProduce,
  onReset,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  onProduce(boardItemId: string): void;
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
        Drag inventory items onto empty board cells. Drag board items onto matching items to merge, empty cells to move, or inventory slots to store.
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
          {selectedItem.canProduce ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onProduce(selectedBoardItem.id)}
              className="mt-4 w-full rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50"
            >
              Produce around item
            </button>
          ) : null}
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
