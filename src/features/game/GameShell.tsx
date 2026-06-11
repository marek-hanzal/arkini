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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { gameDataIndex, resolveMergeRule, type BuildRecipeId, type ItemId } from "~/domains/game-data";
import type { BoardViewItem, GameView, InventorySlot, ProducerDropResult, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { useGameAction, useGameDataInvalidation, useGameView } from "~/hooks/useGameView";

type DragData =
  | { kind: "board"; boardItemId: string; itemId: string }
  | { kind: "inventory"; slotIndex: number; itemId: string; quantity: number };

type DropData =
  | { kind: "cell"; x: number; y: number; boardItemId: string | null }
  | { kind: "inventory-slot"; slotIndex: number }
  | { kind: "inventory-bin" };

interface Flyer {
  id: string;
  itemId: string;
  from: RectLike;
  to: RectLike;
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface InlineFeedback {
  id: string;
  message: string;
  tone: "info" | "error";
}

const columns = 7;
const rows = 9;
const flyMs = 280;
const feedbackMs = 1400;
const flashMs = 650;

export function GameShell() {
  const gameQuery = useGameView();
  const game = gameQuery.data;
  const invalidateGameData = useGameDataInvalidation();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [committedDrag, setCommittedDrag] = useState<DragData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [buildCell, setBuildCell] = useState<{ x: number; y: number } | null>(null);
  const [hiddenBoardIds, setHiddenBoardIds] = useState(() => new Set<string>());
  const [hiddenInventorySlots, setHiddenInventorySlots] = useState(() => new Set<number>());
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [dragPreviewRect, setDragPreviewRect] = useState<Pick<RectLike, "width" | "height"> | null>(null);
  const [invalidBoardCellKey, setInvalidBoardCellKey] = useState<string | null>(null);
  const [pulsedBoardCellKey, setPulsedBoardCellKey] = useState<string | null>(null);
  const [invalidInventorySlot, setInvalidInventorySlot] = useState<number | null>(null);
  const [pulsedInventorySlot, setPulsedInventorySlot] = useState<number | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<InlineFeedback | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

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
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (advanceAuto.isPending) return;
      advanceAuto.mutate(undefined, {
        async onSuccess(results) {
          if (results.length === 0) return;
          await invalidateGameData();
          pulseProducerDrops(results);
        },
        onError(error) {
          showError(error);
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
      if (source.kind === "inventory" && target.kind === "cell") {
        if (target.boardItemId) throw new Error("Cell is occupied.");
        setCommittedDrag(source);
        await placeInventory.mutateAsync({ slotIndex: source.slotIndex, x: target.x, y: target.y });
        pulseBoardCell(cellKey(target.x, target.y));
        setCommittedDrag(null);
        return;
      }

      if (source.kind === "inventory" && target.kind === "inventory-slot") {
        setCommittedDrag(source);
        await swapInventory.mutateAsync({ sourceSlotIndex: source.slotIndex, targetSlotIndex: target.slotIndex });
        pulseInventorySlot(target.slotIndex);
        setCommittedDrag(null);
        return;
      }

      if (source.kind === "board" && target.kind === "cell") {
        setCommittedDrag(source);
        if (target.boardItemId) {
          await mergeBoard.mutateAsync({ sourceBoardItemId: source.boardItemId, targetBoardItemId: target.boardItemId });
          pulseBoardCell(cellKey(target.x, target.y));
          setCommittedDrag(null);
          return;
        }

        await moveBoard.mutateAsync({ boardItemId: source.boardItemId, x: target.x, y: target.y });
        pulseBoardCell(cellKey(target.x, target.y));
        setCommittedDrag(null);
        return;
      }

      if (source.kind === "board" && target.kind === "inventory-slot") {
        setCommittedDrag(source);
        await stashBoard.mutateAsync({ boardItemId: source.boardItemId, slotIndex: target.slotIndex });
        pulseInventorySlot(target.slotIndex);
        setCommittedDrag(null);
        return;
      }

      if (source.kind === "board" && target.kind === "inventory-bin") {
        setCommittedDrag(source);
        await stashBoard.mutateAsync({ boardItemId: source.boardItemId });
        setCommittedDrag(null);
      }
    } catch (error) {
      setCommittedDrag(null);
      flashInvalidTarget(source, target, game);
      showError(error);
    }
  }

  async function produceFrom(boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") {
    try {
      const result = await produce.mutateAsync({ boardItemId: boardItem.id, activation });
      await invalidateGameData();
      pulseProducerDrops([result]);
      pulseBoardCell(cellKey(boardItem.x, boardItem.y));
    } catch (error) {
      flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
      showError(error);
    }
  }

  async function stashWithFly(boardItem: BoardViewItem) {
    const rect = queryRect(`[data-board-item-id="${cssEscape(boardItem.id)}"]`);
    if (!rect) return;

    const targetRect = queryRect("[data-inventory-summary]") ?? syntheticBottomRect();
    hideBoardItem(boardItem.id);
    addFlyer(boardItem.itemId, rect, targetRect);

    try {
      await wait(flyMs * 0.65);
      await stashBoard.mutateAsync({ boardItemId: boardItem.id });
      pulseInventorySlot(game?.firstEmptyInventorySlotIndex ?? null);
    } catch (error) {
      showBoardItem(boardItem.id);
      flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
      showError(error);
    }
  }

  async function placeInventoryFromDoubleTap(slot: InventorySlot) {
    if (!slot.stack || !game) return;
    const cell = firstFreeCell(game);
    if (!cell) {
      flashInventorySlot(slot.slotIndex, "error");
      showError(new Error("Board is full."));
      return;
    }

    const sourceRect = queryRect(`[data-inventory-slot="${slot.slotIndex}"]`);
    const targetRect = queryRect(`[data-board-cell="${cell.x}:${cell.y}"]`);
    const isLastItem = slot.stack.quantity <= 1;

    if (sourceRect && targetRect) {
      if (isLastItem) hideInventorySlot(slot.slotIndex);
      addFlyer(slot.stack.itemId, sourceRect, targetRect);
    }

    try {
      await wait(flyMs * 0.55);
      await placeInventory.mutateAsync({ slotIndex: slot.slotIndex, x: cell.x, y: cell.y });
      if (isLastItem) {
        window.setTimeout(() => showInventorySlot(slot.slotIndex), 120);
      }
      pulseBoardCell(cellKey(cell.x, cell.y));
    } catch (error) {
      showInventorySlot(slot.slotIndex);
      flashInventorySlot(slot.slotIndex, "error");
      showError(error);
    }
  }

  function pulseProducerDrops(results: ProducerDropResult[]) {
    for (const result of results) {
      const sourceRect = queryRect(`[data-board-item-id="${cssEscape(result.producerBoardItemId)}"]`);
      if (!sourceRect) continue;

      for (const placement of result.placements) {
        const targetRect = placement.kind === "board"
          ? queryRect(`[data-board-cell="${placement.x}:${placement.y}"]`)
          : queryRect(`[data-inventory-slot="${placement.slotIndex}"]`) ?? queryRect("[data-inventory-summary]");

        if (!targetRect) continue;
        addFlyer(placement.itemId, sourceRect, targetRect);
      }
    }
  }

  function addFlyer(itemId: string, from: RectLike, to: RectLike) {
    const id = crypto.randomUUID();
    setFlyers((current) => [...current, { id, itemId, from, to }]);
    window.setTimeout(() => setFlyers((current) => current.filter((flyer) => flyer.id !== id)), flyMs + 80);
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

  function flashBoardCell(key: string | null, tone: "pulse" | "error") {
    if (!key) return;

    if (tone === "error") {
      setInvalidBoardCellKey(key);
      window.setTimeout(() => setInvalidBoardCellKey((current) => current === key ? null : current), flashMs);
      return;
    }

    setPulsedBoardCellKey(key);
    window.setTimeout(() => setPulsedBoardCellKey((current) => current === key ? null : current), flashMs);
  }

  function pulseBoardCell(key: string | null) {
    flashBoardCell(key, "pulse");
  }

  function flashInventorySlot(slotIndex: number | null, tone: "pulse" | "error") {
    if (slotIndex === null || slotIndex === undefined) return;

    if (tone === "error") {
      setInvalidInventorySlot(slotIndex);
      window.setTimeout(() => setInvalidInventorySlot((current) => current === slotIndex ? null : current), flashMs);
      return;
    }

    setPulsedInventorySlot(slotIndex);
    window.setTimeout(() => setPulsedInventorySlot((current) => current === slotIndex ? null : current), flashMs);
  }

  function pulseInventorySlot(slotIndex: number | null) {
    flashInventorySlot(slotIndex, "pulse");
  }

  function flashInvalidTarget(source: DragData, target: DropData, currentGame: GameView) {
    if (source.kind === "board") {
      const boardItem = currentGame.boardItemsById[source.boardItemId];
      if (boardItem) flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
    } else {
      flashInventorySlot(source.slotIndex, "error");
    }

    if (target.kind === "cell") {
      flashBoardCell(cellKey(target.x, target.y), "error");
      return;
    }

    if (target.kind === "inventory-slot") {
      flashInventorySlot(target.slotIndex, "error");
    }
  }

  function showFeedback(message: string, tone: InlineFeedback["tone"] = "info") {
    const id = crypto.randomUUID();
    setInlineFeedback({ id, message, tone });

    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    feedbackTimeoutRef.current = window.setTimeout(() => {
      setInlineFeedback((current) => current?.id === id ? null : current);
    }, feedbackMs);
  }

  function showError(error: unknown) {
    showFeedback(error instanceof Error ? error.message : String(error), "error");
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
          {inlineFeedback ? (
            <p className={cn(
              "ak-feedback mt-2 rounded-sm px-2 py-1 text-xs",
              inlineFeedback.tone === "error" ? "bg-red-950/40 text-red-100" : "bg-sky-950/40 text-sky-100",
            )}
            >
              {inlineFeedback.message}
            </p>
          ) : null}
        </div>

        <Board
          game={game}
          activeDrag={activeDrag}
          committedDrag={committedDrag}
          hiddenBoardIds={hiddenBoardIds}
          invalidBoardCellKey={invalidBoardCellKey}
          pulsedBoardCellKey={pulsedBoardCellKey}
          nowMs={nowMs}
          onEmptyDoubleActivate={setBuildCell}
          onTileDoubleActivate={(item) => {
            if (!item.producer) {
              void stashWithFly(item);
              return;
            }

            if (item.producer.trigger === "auto") {
              togglePause.mutate({ boardItemId: item.id }, { onError: showError });
              return;
            }

            const activation = shouldExhaustOnDoubleActivate(item.itemId) ? "exhaust" : "single";
            void produceFrom(item, activation);
          }}
          onTogglePause={(item) => togglePause.mutate({ boardItemId: item.id }, { onError: showError })}
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
                  pulseBoardCell(cellKey(buildCell.x, buildCell.y));
                  setBuildCell(null);
                },
                onError(error) {
                  flashBoardCell(cellKey(buildCell.x, buildCell.y), "error");
                  showError(error);
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
        invalidInventorySlot={invalidInventorySlot}
        pulsedInventorySlot={pulsedInventorySlot}
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

function Board({
  game,
  activeDrag,
  committedDrag,
  hiddenBoardIds,
  invalidBoardCellKey,
  pulsedBoardCellKey,
  nowMs,
  onEmptyDoubleActivate,
  onTileDoubleActivate,
  onTogglePause,
}: Readonly<{
  game: GameView;
  activeDrag: DragData | null;
  committedDrag: DragData | null;
  hiddenBoardIds: ReadonlySet<string>;
  invalidBoardCellKey: string | null;
  pulsedBoardCellKey: string | null;
  nowMs: number;
  onEmptyDoubleActivate(cell: { x: number; y: number }): void;
  onTileDoubleActivate(item: BoardViewItem): void;
  onTogglePause(item: BoardViewItem): void;
}>) {
  const cells = useMemo(() => Array.from({ length: columns * rows }, (_, index) => ({ x: index % columns, y: Math.floor(index / columns) })), []);

  return (
    <div className="grid w-full grid-cols-7 overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40">
      {cells.map((cell) => {
        const key = cellKey(cell.x, cell.y);
        const boardItem = game.boardItemByCellKey[key] ?? null;
        const canMerge = activeDrag?.kind === "board" && boardItem && boardItem.id !== activeDrag.boardItemId
          ? Boolean(resolveMergeRule(activeDrag.itemId as ItemId, boardItem.itemId as ItemId))
          : false;

        return (
          <BoardCell
            key={key}
            x={cell.x}
            y={cell.y}
            boardItem={boardItem}
            canMerge={canMerge}
            invalid={invalidBoardCellKey === key}
            pulsed={pulsedBoardCellKey === key}
            onEmptyDoubleActivate={onEmptyDoubleActivate}
          >
            {boardItem ? (
              <BoardTile
                boardItem={boardItem}
                item={game.items[boardItem.itemId]}
                hidden={
                  hiddenBoardIds.has(boardItem.id)
                  || (activeDrag?.kind === "board" && activeDrag.boardItemId === boardItem.id)
                  || (committedDrag?.kind === "board" && committedDrag.boardItemId === boardItem.id)
                }
                nowMs={nowMs}
                onDoubleActivate={() => onTileDoubleActivate(boardItem)}
                onTogglePause={() => onTogglePause(boardItem)}
              />
            ) : null}
          </BoardCell>
        );
      })}
    </div>
  );
}

function BoardCell({
  x,
  y,
  boardItem,
  canMerge,
  invalid,
  pulsed,
  children,
  onEmptyDoubleActivate,
}: Readonly<{
  x: number;
  y: number;
  boardItem: BoardViewItem | null;
  canMerge: boolean;
  invalid: boolean;
  pulsed: boolean;
  children: ReactNode;
  onEmptyDoubleActivate(cell: { x: number; y: number }): void;
}>) {
  const id = `cell:${x}:${y}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { kind: "cell", x, y, boardItemId: boardItem?.id ?? null } satisfies DropData });
  const tapHandlers = useDoubleActivate(() => {
    if (!boardItem) onEmptyDoubleActivate({ x, y });
  });

  return (
    <div
      ref={setNodeRef}
      data-board-cell={`${x}:${y}`}
      className={cn(
        "relative aspect-square border-b border-r border-slate-800/80 bg-slate-900/55 transition-colors duration-200",
        x === columns - 1 && "border-r-0",
        y === rows - 1 && "border-b-0",
        isOver && "bg-slate-800/80",
        canMerge && isOver && "ring-2 ring-inset ring-emerald-300/80",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        pulsed && !invalid && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
      )}
      onDoubleClick={() => !boardItem && onEmptyDoubleActivate({ x, y })}
      onPointerDown={tapHandlers.onPointerDown}
      onPointerMove={tapHandlers.onPointerMove}
      onPointerUp={tapHandlers.onPointerUp}
    >
      {children}
    </div>
  );
}

function BoardTile({
  boardItem,
  item,
  hidden,
  nowMs,
  onDoubleActivate,
  onTogglePause,
}: Readonly<{
  boardItem: BoardViewItem;
  item: ViewItem;
  hidden: boolean;
  nowMs: number;
  onDoubleActivate(): void;
  onTogglePause(): void;
}>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `board:${boardItem.id}`,
    data: { kind: "board", boardItemId: boardItem.id, itemId: boardItem.itemId } satisfies DragData,
  });
  const tapHandlers = useDoubleActivate(onDoubleActivate);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-board-item-id={boardItem.id}
      className={cn("absolute inset-0 touch-none", (hidden || isDragging) && "opacity-0")}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleActivate();
      }}
      onPointerDown={tapHandlers.onPointerDown}
      onPointerMove={tapHandlers.onPointerMove}
      onPointerUp={tapHandlers.onPointerUp}
    >
      <Tile item={item} producer={boardItem.producer} nowMs={nowMs} onTogglePause={onTogglePause} />
    </div>
  );
}

function InventorySheet({
  game,
  open,
  hiddenInventorySlots,
  committedDrag,
  activeDrag,
  invalidInventorySlot,
  pulsedInventorySlot,
  onOpenChange,
  onSlotDoubleActivate,
}: Readonly<{
  game: GameView;
  open: boolean;
  hiddenInventorySlots: ReadonlySet<number>;
  committedDrag: DragData | null;
  activeDrag: DragData | null;
  invalidInventorySlot: number | null;
  pulsedInventorySlot: number | null;
  onOpenChange(open: boolean): void;
  onSlotDoubleActivate(slot: InventorySlot): void;
}>) {
  const { setNodeRef, isOver } = useDroppable({ id: "inventory-bin", data: { kind: "inventory-bin" } satisfies DropData });
  const filled = game.inventory.filter((slot) => slot.stack).length;

  return (
    <>
      {open ? <button type="button" aria-label="Close inventory" className="fixed inset-0 z-20 bg-slate-950/50" onClick={() => onOpenChange(false)} /> : null}

      <aside
        ref={setNodeRef}
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        className={cn(
          "fixed inset-x-0 z-30 mx-auto w-[min(100vw-1.5rem,430px)] rounded-t-lg border border-slate-800 bg-slate-950/96 shadow-2xl shadow-black/60 transition-transform duration-200",
          open ? "translate-y-0" : "translate-y-[calc(100%-5rem)]",
          isOver && "ring-2 ring-emerald-300/70",
        )}
      >
        <div data-inventory-summary className="border-b border-slate-800/80 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-emerald-300">Inventory</p>
              <p className="text-sm text-slate-300">{filled}/{game.inventory.length} slots</p>
            </div>
            <button
              type="button"
              className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300"
              onClick={() => onOpenChange(!open)}
            >
              {open ? "Close" : "Open"}
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-3 pb-4 pt-3">
          <div className="grid grid-cols-4 gap-1.5">
            {game.inventory.map((slot) => (
              <InventoryCell
                key={slot.slotIndex}
                slot={slot}
                item={slot.stack ? game.items[slot.stack.itemId] : null}
                hidden={
                  hiddenInventorySlots.has(slot.slotIndex)
                  || (activeDrag?.kind === "inventory" && activeDrag.slotIndex === slot.slotIndex && (slot.stack?.quantity ?? 0) <= 1)
                  || (committedDrag?.kind === "inventory" && committedDrag.slotIndex === slot.slotIndex && (slot.stack?.quantity ?? 0) <= 1)
                }
                invalid={invalidInventorySlot === slot.slotIndex}
                pulsed={pulsedInventorySlot === slot.slotIndex}
                onDoubleActivate={() => onSlotDoubleActivate(slot)}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function InventoryCell({
  slot,
  item,
  hidden,
  invalid,
  pulsed,
  onDoubleActivate,
}: Readonly<{
  slot: InventorySlot;
  item: ViewItem | null;
  hidden: boolean;
  invalid: boolean;
  pulsed: boolean;
  onDoubleActivate(): void;
}>) {
  const { setNodeRef, isOver } = useDroppable({ id: `inventory:${slot.slotIndex}`, data: { kind: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData });
  const stack = slot.stack;

  return (
    <div
      ref={setNodeRef}
      data-inventory-slot={slot.slotIndex}
      className={cn(
        "relative aspect-square rounded-sm border border-slate-800 bg-slate-900/70 transition-colors duration-200",
        isOver && "bg-slate-800 ring-1 ring-emerald-300/70",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        pulsed && !invalid && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
      )}
    >
      {stack && item ? <InventoryTile slot={slot} item={item} hidden={hidden} onDoubleActivate={onDoubleActivate} /> : null}
    </div>
  );
}

function InventoryTile({ slot, item, hidden, onDoubleActivate }: Readonly<{ slot: InventorySlot; item: ViewItem; hidden: boolean; onDoubleActivate(): void }>) {
  const stack = slot.stack;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inventory:${slot.slotIndex}:drag`,
    disabled: !stack,
    data: stack ? { kind: "inventory", slotIndex: slot.slotIndex, itemId: stack.itemId, quantity: stack.quantity } satisfies DragData : undefined,
  });
  const tapHandlers = useDoubleActivate(onDoubleActivate);

  if (!stack) return null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("absolute inset-0 touch-none", (hidden || isDragging) && "opacity-0")}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleActivate();
      }}
      onPointerDown={tapHandlers.onPointerDown}
      onPointerMove={tapHandlers.onPointerMove}
      onPointerUp={tapHandlers.onPointerUp}
    >
      <Tile item={item} quantity={stack.quantity} />
    </div>
  );
}

function Tile({
  item,
  quantity,
  producer,
  nowMs,
  dragOverlay,
  overlaySize,
  onTogglePause,
}: Readonly<{
  item: ViewItem;
  quantity?: number;
  producer?: BoardViewItem["producer"];
  nowMs?: number;
  dragOverlay?: boolean;
  overlaySize?: Pick<RectLike, "width" | "height"> | null;
  onTogglePause?(): void;
}>) {
  const producerUi = producer ? getProducerUiState(producer, nowMs ?? Date.now()) : null;

  return (
    <div
      className={cn(
        "relative grid h-full w-full place-items-center p-[10%] text-slate-50 transition-opacity duration-300",
        producerUi?.waiting && "opacity-80",
        producerUi?.paused && "opacity-65",
        dragOverlay && "shadow-2xl shadow-black/50",
      )}
      style={dragOverlay && overlaySize ? { width: overlaySize.width, height: overlaySize.height } : undefined}
    >
      <img src={item.assetSrc} alt="" draggable={false} className="h-full w-full object-contain" />
      {quantity && quantity > 1 ? <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-slate-950/80 px-1 text-[0.62rem] font-bold text-slate-100">{quantity}</span> : null}
      {producer && producerUi ? <ProducerBadge producer={producer} ui={producerUi} onTogglePause={onTogglePause} /> : null}
    </div>
  );
}

interface ProducerUiState {
  label: string;
  title: string;
  progress: number | null;
  waiting: boolean;
  paused: boolean;
}

function ProducerBadge({ producer, ui, onTogglePause }: Readonly<{ producer: NonNullable<BoardViewItem["producer"]>; ui: ProducerUiState; onTogglePause?(): void }>) {
  const content = (
    <>
      <span>{ui.label}</span>
      {ui.progress !== null ? (
        <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-sm bg-slate-700/80">
          <span className="block h-full bg-emerald-300/80 transition-[width] duration-300" style={{ width: `${ui.progress * 100}%` }} />
        </span>
      ) : null}
    </>
  );

  if (producer.trigger !== "auto") {
    return <span title={ui.title} className="absolute left-0.5 top-0.5 min-w-5 rounded-sm bg-slate-950/85 px-1 pb-0.5 pt-0.5 text-center text-[0.56rem] font-bold text-emerald-200">{content}</span>;
  }

  return (
    <button
      type="button"
      title={ui.title}
      className="absolute left-0.5 top-0.5 min-w-5 rounded-sm bg-slate-950/85 px-1 pb-0.5 pt-0.5 text-center text-[0.56rem] font-bold text-emerald-200"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onTogglePause?.();
      }}
    >
      {content}
    </button>
  );
}

function BuildSheet({ game, cell, onClose, onBuild }: Readonly<{ game: GameView; cell: { x: number; y: number } | null; onClose(): void; onBuild(recipeId: BuildRecipeId): void }>) {
  if (!cell) return null;

  return (
    <>
      <button type="button" aria-label="Close build sheet" className="fixed inset-0 z-40 bg-slate-950/50" onClick={onClose} />
      <div
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        className="fixed inset-x-0 z-50 mx-auto max-w-[430px] rounded-t-lg border border-slate-800 bg-slate-950 p-4 shadow-2xl shadow-black/70"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-emerald-300">Build</p>
            <p className="text-sm text-slate-300">Cell {cell.x}:{cell.y}</p>
          </div>
          <button type="button" className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300" onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-2">
          {game.buildRecipes.map((recipe) => {
            const result = game.items[recipe.resultItemId];
            const blueprint = game.items[recipe.blueprintItemId];
            return (
              <button key={recipe.id} type="button" disabled={!recipe.canBuild} className="flex items-center gap-3 rounded-sm border border-slate-800 bg-slate-900/80 p-2 text-left disabled:opacity-40" onClick={() => onBuild(recipe.id)}>
                <img src={result.assetSrc} alt="" className="h-10 w-10 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100">{result.name}</span>
                  <span className="block truncate text-xs text-slate-400">{blueprint.name} + {recipe.costs.map((cost) => `${cost.quantity}× ${game.items[cost.itemId]?.name ?? cost.itemId}`).join(", ")}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Flyer({ flyer, item }: Readonly<{ flyer: Flyer; item: ViewItem }>) {
  const scale = flyer.from.width > 0 ? flyer.to.width / flyer.from.width : 1;

  return (
    <div
      className="ak-fly pointer-events-none fixed z-50"
      style={{
        left: flyer.from.left,
        top: flyer.from.top,
        width: flyer.from.width,
        height: flyer.from.height,
        "--ak-x": `${flyer.to.left - flyer.from.left}px`,
        "--ak-y": `${flyer.to.top - flyer.from.top}px`,
        "--ak-scale": `${scale}`,
      } as CSSProperties}
    >
      <img src={item.assetSrc} alt="" className="h-full w-full object-contain" />
    </div>
  );
}

function useDoubleActivate(onDoubleActivate: () => void) {
  const lastTapMsRef = useRef(0);
  const movedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse") return;
      movedRef.current = false;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse") return;
      const start = pointerStartRef.current;
      if (!start) return;
      if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) {
        movedRef.current = true;
      }
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" || movedRef.current) return;
      const now = Date.now();
      if (now - lastTapMsRef.current <= 320) {
        lastTapMsRef.current = 0;
        event.preventDefault();
        event.stopPropagation();
        onDoubleActivate();
        return;
      }
      lastTapMsRef.current = now;
    },
  };
}

function shouldExhaustOnDoubleActivate(itemId: string) {
  const producer = gameDataIndex.producersByItemId.get(itemId as ItemId);
  return producer?.doubleClickBehavior === "exhaust";
}

function getProducerUiState(producer: NonNullable<BoardViewItem["producer"]>, nowMs: number): ProducerUiState {
  const cooldownUntil = producer.cooldownUntil ? Date.parse(producer.cooldownUntil) : 0;
  const nextDropAt = producer.nextDropAt ? Date.parse(producer.nextDropAt) : 0;
  const rechargeUntil = producer.rechargeUntil ? Date.parse(producer.rechargeUntil) : 0;

  if (producer.paused) {
    return { label: "||", title: "Paused", progress: null, waiting: true, paused: true };
  }

  if (producer.trigger === "click") {
    const cooldownLeft = Math.max(0, cooldownUntil - nowMs);
    const max = producer.cooldownMs ?? cooldownLeft;
    if (cooldownLeft > 0) {
      return {
        label: formatMs(cooldownLeft),
        title: `Cooling down: ${formatMs(cooldownLeft)}`,
        progress: max > 0 ? 1 - cooldownLeft / max : null,
        waiting: true,
        paused: false,
      };
    }

    const charges = producer.remainingCharges;
    return {
      label: charges !== null && charges !== undefined ? String(charges) : "▶",
      title: charges !== null && charges !== undefined ? `${charges} charges left` : "Ready",
      progress: null,
      waiting: false,
      paused: false,
    };
  }

  const rechargeLeft = Math.max(0, rechargeUntil - nowMs);
  if (rechargeLeft > 0) {
    const max = producer.mode.type === "auto" ? producer.mode.rechargeMs : rechargeLeft;
    return {
      label: formatMs(rechargeLeft),
      title: `Recharging: ${formatMs(rechargeLeft)}`,
      progress: max > 0 ? 1 - rechargeLeft / max : null,
      waiting: true,
      paused: false,
    };
  }

  const tickLeft = Math.max(0, nextDropAt - nowMs);
  const available = producer.autoAvailable ?? 0;
  if (tickLeft > 0) {
    const max = producer.mode.type === "auto" ? producer.mode.tickMs : tickLeft;
    return {
      label: String(available),
      title: `Next drop in ${formatMs(tickLeft)} · ${available} queued charges`,
      progress: max > 0 ? 1 - tickLeft / max : null,
      waiting: true,
      paused: false,
    };
  }

  return {
    label: String(available || "▶"),
    title: `${available} queued charges ready`,
    progress: null,
    waiting: false,
    paused: false,
  };
}

function firstFreeCell(game: GameView) {
  for (let y = 0; y < game.save.boardHeight; y += 1) {
    for (let x = 0; x < game.save.boardWidth; x += 1) {
      if (!game.boardItemByCellKey[cellKey(x, y)]) return { x, y };
    }
  }
  return null;
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function queryRect(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
}

function syntheticBottomRect(): RectLike {
  return {
    left: window.innerWidth / 2 - 28,
    top: window.innerHeight - 92,
    width: 56,
    height: 56,
  };
}

function cssEscape(value: string) {
  return value.replaceAll('"', '\\"');
}

function without<T>(set: ReadonlySet<T>, value: T) {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatMs(ms: number) {
  if (ms <= 0) return "▶";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}
