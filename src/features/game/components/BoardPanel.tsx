import type { GameView } from "~/domains/database";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { MouseEvent } from "react";
import { useMemo } from "react";
import { cellClass, cellSize } from "./constants";
import type { BoardItem, BuildCell, DragData, DropData, Selection } from "./types";
import { boardCellId, boardCellKey } from "./helpers/boardCellId";
import { getBoardCellDropState } from "./helpers/getBoardCellDropState";
import { getCooldown } from "./helpers/getCooldown";
import { TileContent } from "./TileContent";

export function BoardPanel({
  game,
  selection,
  activeDrag,
  pending,
  invalidTargetId,
  committedDrag,
  hiddenBoardItemIds,
  mergePulseBoardItemId,
  boardPulseCell,
  nowMs,
  onSelect,
  onProduce,
  onStash,
  onOpenBuild,
}: Readonly<{
  game: GameView;
  selection: Selection;
  activeDrag: DragData | null;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  hiddenBoardItemIds: ReadonlySet<string>;
  mergePulseBoardItemId: string | null;
  boardPulseCell: string | null;
  nowMs: number;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
  onOpenBuild(cell: BuildCell): void;
}>) {
  const itemByCell = useMemo(
    () => new Map(game.boardItems.map((item) => [boardCellKey(item.x, item.y), item])),
    [game.boardItems],
  );
  const cells = Array.from({ length: game.save.boardWidth * game.save.boardHeight }, (_, index) => ({
    x: index % game.save.boardWidth,
    y: Math.floor(index / game.save.boardWidth),
  }));

  return (
    <section className="w-fit max-w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Board</p>
          <h2 className="text-base font-semibold text-white">Merge space</h2>
        </div>
        <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400">
          {game.save.boardWidth}×{game.save.boardHeight}
        </p>
      </div>

      <div className="grid w-fit gap-0 overflow-hidden rounded-xl border border-slate-800" style={{ gridTemplateColumns: `repeat(${game.save.boardWidth}, ${cellSize})` }}>
        {cells.map((cell) => {
          const key = boardCellKey(cell.x, cell.y);
          const boardItem = itemByCell.get(key);
          return (
            <BoardCell
              key={key}
              game={game}
              x={cell.x}
              y={cell.y}
              boardItem={boardItem ?? null}
              selected={selection?.type === "board" && selection.boardItemId === boardItem?.id}
              activeDrag={activeDrag}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              hidden={Boolean(boardItem && hiddenBoardItemIds.has(boardItem.id))}
              mergePulse={mergePulseBoardItemId === boardItem?.id}
              boardPulse={boardPulseCell === key}
              nowMs={nowMs}
              onSelect={onSelect}
              onProduce={onProduce}
              onStash={onStash}
              onOpenBuild={onOpenBuild}
            />
          );
        })}
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
  hidden,
  mergePulse,
  boardPulse,
  nowMs,
  onSelect,
  onProduce,
  onStash,
  onOpenBuild,
}: Readonly<{
  game: GameView;
  x: number;
  y: number;
  boardItem: BoardItem | null;
  selected: boolean;
  activeDrag: DragData | null;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  hidden: boolean;
  mergePulse: boolean;
  boardPulse: boolean;
  nowMs: number;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
  onOpenBuild(cell: BuildCell): void;
}>) {
  const dropId = boardCellId(x, y);
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "board-cell", x, y, boardItemId: boardItem?.id } satisfies DropData,
    disabled: pending,
  });
  const sourceCommitted = committedDrag?.type === "board" && committedDrag.boardItemId === boardItem?.id;
  const visibleBoardItem = sourceCommitted || hidden ? null : boardItem;
  const invalid = invalidTargetId === dropId || invalidTargetId === boardItem?.id;
  const item = visibleBoardItem ? game.items[visibleBoardItem.itemId] : null;
  const dropState = isOver ? getBoardCellDropState(game, activeDrag, boardItem) : "neutral";
  const empty = !boardItem;

  function handleEmptyClick(event: MouseEvent<HTMLDivElement>) {
    if (!empty || pending || activeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenBuild({ x, y });
  }

  return (
    <div
      ref={setNodeRef}
      data-board-cell-id={boardCellKey(x, y)}
      onClick={handleEmptyClick}
      className={[
        cellClass,
        "group/cell relative bg-slate-950/80 shadow-inner shadow-black/30",
        empty && !pending && !activeDrag ? "cursor-pointer hover:border-amber-300/60 hover:bg-amber-950/10" : "",
        invalid
          ? "border-red-300 bg-red-950/40"
          : boardPulse
            ? "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50"
            : dropState === "valid"
              ? "border-emerald-300 bg-emerald-950/40"
              : dropState === "invalid"
                ? "border-red-300 bg-red-950/40"
                : item?.canProduce
                  ? "border-amber-400/30 bg-amber-950/10"
                  : "border-slate-800",
      ].join(" ")}
    >
      {empty && !activeDrag ? <BuildHoverIcon /> : null}
      {visibleBoardItem && item ? (
        <BoardItemCard
          item={item}
          boardItem={visibleBoardItem}
          selected={selected}
          pending={pending}
          mergePulse={mergePulse}
          nowMs={nowMs}
          onSelect={() => onSelect({ type: "board", boardItemId: visibleBoardItem.id })}
          onProduce={() => onProduce(visibleBoardItem.id)}
          onStash={() => onStash(visibleBoardItem.id, visibleBoardItem.itemId)}
        />
      ) : null}
    </div>
  );
}

function BuildHoverIcon() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/cell:opacity-70">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 text-amber-200 drop-shadow-lg">
        <path
          fill="currentColor"
          d="M13.8 2.7a4.7 4.7 0 0 1 5.6 5.7l-2.1-2.1-2.7 2.7 2.1 2.1a4.7 4.7 0 0 1-5.8-5.8L3.3 12.9a2.1 2.1 0 0 0 0 3l4.8 4.8a2.1 2.1 0 0 0 3 0l7.6-7.6a6.4 6.4 0 0 0 2.4-7.9l-.4-.9-4.5 4.5-1-1 4.5-4.5-.9-.4a6.4 6.4 0 0 0-5-.2ZM4.8 14.4l7.5-7.5 4.8 4.8-7.5 7.5a.4.4 0 0 1-.6 0l-4.2-4.2a.4.4 0 0 1 0-.6Z"
        />
      </svg>
    </div>
  );
}

function BoardItemCard({
  item,
  boardItem,
  selected,
  pending,
  mergePulse,
  nowMs,
  onSelect,
  onProduce,
  onStash,
}: Readonly<{
  item: GameView["items"][string];
  boardItem: BoardItem;
  selected: boolean;
  pending: boolean;
  mergePulse: boolean;
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

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1) return;
    onSelect();
  }

  function handleDoubleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onSelect();

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
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={[
        "relative flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 overflow-hidden rounded-lg text-center transition duration-200 active:cursor-grabbing disabled:cursor-not-allowed",
        item.canProduce ? "bg-amber-300/10 shadow-inner shadow-amber-950/30" : "",
        selected ? "bg-emerald-500/15 ring-1 ring-emerald-300" : "hover:bg-slate-800/70",
        mergePulse ? "scale-110 bg-emerald-500/20 ring-2 ring-emerald-200" : "scale-100",
        isDragging ? "opacity-0" : "opacity-100",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      {cooldown.coolingDown ? (
        <div
          className="absolute inset-x-0 bottom-0 origin-bottom bg-amber-300/25 transition-transform duration-200 ease-linear will-change-transform"
          style={{ transform: `scaleY(${cooldown.progress})` }}
        />
      ) : null}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-1">
        <TileContent item={item} />
        {cooldown.coolingDown ? (
          <span className="absolute right-1 top-1 rounded-full bg-slate-950/85 px-1.5 text-[0.58rem] font-bold text-amber-100">
            {Math.ceil(cooldown.remainingMs / 1000)}s
          </span>
        ) : null}
      </div>
    </button>
  );
}
