import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useMemo, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { resolveMergeRule, type ItemId } from "~/domains/game-data";
import type { BoardViewItem, GameView, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { cellKey } from "../helpers";
import { useDoubleActivate } from "../useDoubleActivate";
import { columns, rows, type BuildCell, type DragData, type DropData } from "../types";
import { Tile } from "./Tile";

export function Board({
  game,
  activeDrag,
  committedDrag,
  hiddenBoardIds,
  invalidBoardCellKey,
  pulsedBoardCellKey,
  mergedBoardCellKey,
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
  mergedBoardCellKey: string | null;
  nowMs: number;
  onEmptyDoubleActivate(cell: BuildCell): void;
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
            merged={mergedBoardCellKey === key}
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
  merged,
  children,
  onEmptyDoubleActivate,
}: Readonly<{
  x: number;
  y: number;
  boardItem: BoardViewItem | null;
  canMerge: boolean;
  invalid: boolean;
  pulsed: boolean;
  merged: boolean;
  children: ReactNode;
  onEmptyDoubleActivate(cell: BuildCell): void;
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
        pulsed && !invalid && !merged && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
        merged && !invalid && "ak-merge-pop bg-emerald-950/35 ring-2 ring-inset ring-emerald-200/80",
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

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    tapHandlers.onPointerDown(event);
    listeners?.onPointerDown?.(event);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    tapHandlers.onPointerMove(event);
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    tapHandlers.onPointerUp(event);
  }

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
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
    >
      <Tile item={item} producer={boardItem.producer} nowMs={nowMs} onTogglePause={onTogglePause} />
    </div>
  );
}
