import { useMemo, type ReactNode } from "react";
import { resolveMergeRule, type ItemId } from "~/domains/game-data";
import type { BoardViewItem, GameView, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { cellKey } from "../helpers";
import { usePressActions } from "../usePressActions";
import { columns, rows, type BuildCell, type CommittedDrag, type DragData, type DropData } from "../types";
import { DraggableTileShell, DroppableCell } from "./DragSurface";
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
  onTileSingleActivate,
  onTileDoubleActivate,
  getTilePressMode,
}: Readonly<{
  game: GameView;
  activeDrag: DragData | null;
  committedDrag: CommittedDrag | null;
  hiddenBoardIds: ReadonlySet<string>;
  invalidBoardCellKey: string | null;
  pulsedBoardCellKey: string | null;
  mergedBoardCellKey: string | null;
  nowMs: number;
  onEmptyDoubleActivate(cell: BuildCell): void;
  onTileSingleActivate(item: BoardViewItem): void;
  onTileDoubleActivate(item: BoardViewItem): void;
  getTilePressMode(item: BoardViewItem): "instant" | "delayed";
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
                  || (committedDrag?.hideSource === true && committedDrag.source.kind === "board" && committedDrag.source.boardItemId === boardItem.id)
                }
                nowMs={nowMs}
                pressMode={getTilePressMode(boardItem)}
                onSingleActivate={() => onTileSingleActivate(boardItem)}
                onDoubleActivate={() => onTileDoubleActivate(boardItem)}
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
  const press = usePressActions({
    onDouble: () => {
      if (!boardItem) onEmptyDoubleActivate({ x, y });
    },
  });

  return (
    <DroppableCell
      id={id}
      data={{ kind: "cell", x, y, boardItemId: boardItem?.id ?? null } satisfies DropData}
      data-board-cell={`${x}:${y}`}
      className={(isOver) => cn(
        "relative aspect-square border-b border-r border-slate-800/80 bg-slate-900/55 transition-colors duration-200",
        x === columns - 1 && "border-r-0",
        y === rows - 1 && "border-b-0",
        isOver && "bg-slate-800/80",
        canMerge && isOver && "ring-2 ring-inset ring-emerald-300/80",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        pulsed && !invalid && !merged && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
        merged && !invalid && "ak-merge-pop bg-emerald-950/35 ring-2 ring-inset ring-emerald-200/80",
      )}
      onClick={press.onClick}
      onDoubleClick={press.onDoubleClick}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
    >
      {children}
    </DroppableCell>
  );
}

function BoardTile({
  boardItem,
  item,
  hidden,
  nowMs,
  pressMode,
  onSingleActivate,
  onDoubleActivate,
}: Readonly<{
  boardItem: BoardViewItem;
  item: ViewItem;
  hidden: boolean;
  nowMs: number;
  pressMode: "instant" | "delayed";
  onSingleActivate(): void;
  onDoubleActivate(): void;
}>) {
  return (
    <DraggableTileShell
      id={`board:${boardItem.id}`}
      data={{ kind: "board", boardItemId: boardItem.id, itemId: boardItem.itemId } satisfies DragData}
      data-board-item-id={boardItem.id}
      hidden={hidden}
      className="absolute inset-0 touch-none"
      pressMode={pressMode}
      onSingleActivate={onSingleActivate}
      onDoubleActivate={onDoubleActivate}
    >
      <Tile item={item} producer={boardItem.producer} nowMs={nowMs} />
    </DraggableTileShell>
  );
}
