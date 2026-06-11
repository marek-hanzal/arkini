import type { GameView } from "@arkini/db";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { MouseEvent } from "react";
import { useMemo } from "react";
import { cellClass, cellSize } from "./constants";
import type { BoardItem, DragData, DropData, Selection } from "./types";
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
  mergePulseBoardItemId,
  boardPulseCell,
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
  mergePulseBoardItemId: string | null;
  boardPulseCell: string | null;
  nowMs: number;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
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
        <div className="grid w-fit gap-2" style={{ gridTemplateColumns: `repeat(${game.save.boardWidth}, ${cellSize})` }}>
          {cells.map((cell) => {
            const boardItem = itemByCell.get(boardCellKey(cell.x, cell.y));
            return (
              <BoardCell
                key={boardCellKey(cell.x, cell.y)}
                game={game}
                x={cell.x}
                y={cell.y}
                boardItem={boardItem ?? null}
                selected={selection?.type === "board" && selection.boardItemId === boardItem?.id}
                activeDrag={activeDrag}
                pending={pending}
                invalidTargetId={invalidTargetId}
                committedDrag={committedDrag}
                mergePulse={mergePulseBoardItemId === boardItem?.id}
                boardPulse={boardPulseCell === boardCellKey(cell.x, cell.y)}
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
  mergePulse,
  boardPulse,
  nowMs,
  onSelect,
  onProduce,
  onStash,
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
  mergePulse: boolean;
  boardPulse: boolean;
  nowMs: number;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
}>) {
  const dropId = boardCellId(x, y);
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
      data-board-cell-id={boardCellKey(x, y)}
      className={[
        cellClass,
        "bg-slate-950/80 shadow-inner shadow-black/30",
        invalid
          ? "border-red-300 bg-red-950/40"
          : boardPulse
            ? "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50"
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
          mergePulse={mergePulse}
          nowMs={nowMs}
          onSelect={() => onSelect({ type: "board", boardItemId: visibleBoardItem.id })}
          onProduce={() => onProduce(visibleBoardItem.id)}
          onStash={() => onStash(visibleBoardItem.id, visibleBoardItem.itemId)}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[0.65rem] text-slate-700">
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
        selected ? "bg-emerald-500/15 ring-1 ring-emerald-300" : "hover:bg-slate-800/70",
        mergePulse ? "scale-110 bg-emerald-500/20 ring-2 ring-emerald-200" : "scale-100",
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
