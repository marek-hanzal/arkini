import { useMemo, type ReactNode } from "react";
import { resolveMergeRule, type ItemId } from "~/domains/game-data";
import type { BoardViewItem, GameView, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { cellKey } from "../helpers";
import {
  boardCellNodeId,
  boardContainerNodeId,
  boardSourceId,
  columns,
  rows,
  type BuildCell,
  type GameDragData,
  type GameDropData,
} from "../types";
import { usePressActions } from "../usePressActions";
import { DraggableSurface, DroppableSurface } from "./DragSurface";
import { Tile } from "./Tile";

export function Board({
  game,
  activeDrag,
  isSourceHidden,
  invalidBoardCellKey,
  mergedBoardCellKey,
  nowMs,
  onEmptyDoubleActivate,
  onTileSingleActivate,
  onTileDoubleActivate,
}: Readonly<{
  game: GameView;
  activeDrag: GameDragData | null;
  isSourceHidden(sourceId: string): boolean;
  invalidBoardCellKey: string | null;
  mergedBoardCellKey: string | null;
  nowMs: number;
  onEmptyDoubleActivate(cell: BuildCell): void;
  onTileSingleActivate(item: BoardViewItem): void;
  onTileDoubleActivate(item: BoardViewItem): void;
}>) {
  const cells = useMemo(() => Array.from({ length: columns * rows }, (_, index) => ({ x: index % columns, y: Math.floor(index / columns) })), []);

  return (
    <div
      data-drag-boundary-id={boardContainerNodeId}
      className="grid w-full grid-cols-7 overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
    >
      {cells.map((cell) => {
        const key = cellKey(cell.x, cell.y);
        const boardItem = game.boardItemByCellKey[key] ?? null;
        const viewItem = boardItem ? game.items[boardItem.itemId] : null;
        const canMerge = activeDrag?.source.kind === "board" && boardItem && boardItem.id !== activeDrag.source.boardItemId
          ? Boolean(resolveMergeRule(activeDrag.itemId as ItemId, boardItem.itemId as ItemId))
          : false;
        const producerReady = isProducerReady(boardItem?.producer ?? null, nowMs);

        return (
          <BoardCell
            key={key}
            x={cell.x}
            y={cell.y}
            boardItem={boardItem}
            canMerge={canMerge}
            invalid={invalidBoardCellKey === key}
            merged={mergedBoardCellKey === key}
            producerReady={producerReady}
            onEmptyDoubleActivate={onEmptyDoubleActivate}
          >
            {boardItem && viewItem ? (
              <BoardTile
                boardItem={boardItem}
                item={viewItem}
                hidden={isSourceHidden(boardSourceId(boardItem.id))}
                nowMs={nowMs}
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
  merged,
  producerReady,
  children,
  onEmptyDoubleActivate,
}: Readonly<{
  x: number;
  y: number;
  boardItem: BoardViewItem | null;
  canMerge: boolean;
  invalid: boolean;
  merged: boolean;
  producerReady: boolean;
  children: ReactNode;
  onEmptyDoubleActivate(cell: BuildCell): void;
}>) {
  const id = boardCellNodeId(x, y);
  const press = usePressActions({
    onDouble: () => {
      if (!boardItem) onEmptyDoubleActivate({ x, y });
    },
  });

  return (
    <DroppableSurface
      id={id}
      nodeId={id}
      payload={{ targetId: id, targetNodeId: id, target: { kind: "cell", x, y, boardItemId: boardItem?.id ?? null } } satisfies GameDropData}
      data-board-cell={`${x}:${y}`}
      className={(isOver) => cn(
        "relative aspect-square touch-none border-b border-r border-slate-800/80 bg-slate-900/55 transition-colors duration-200",
        x === columns - 1 && "border-r-0",
        y === rows - 1 && "border-b-0",
        isOver && !canMerge && "bg-slate-800/80",
        canMerge && "ak-merge-target transition-none",
        canMerge && isOver && "ak-merge-target-over",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        (merged || producerReady) && !invalid && "ak-cell-success",
      )}
      {...press.pressProps}
    >
      {children}
    </DroppableSurface>
  );
}


function isProducerReady(producer: BoardViewItem["producer"], nowMs: number) {
  if (!producer || producer.paused) return false;

  if (producer.trigger === "click") {
    const cooldownUntil = producer.cooldownUntil ? Date.parse(producer.cooldownUntil) : 0;
    const hasCharges = producer.remainingCharges === null || producer.remainingCharges === undefined || producer.remainingCharges > 0;
    return hasCharges && cooldownUntil <= nowMs;
  }

  const rechargeUntil = producer.rechargeUntil ? Date.parse(producer.rechargeUntil) : 0;
  return rechargeUntil <= nowMs && (producer.autoAvailable ?? 0) > 0;
}

function BoardTile({
  boardItem,
  item,
  hidden,
  nowMs,
  onSingleActivate,
  onDoubleActivate,
}: Readonly<{
  boardItem: BoardViewItem;
  item: ViewItem;
  hidden: boolean;
  nowMs: number;
  onSingleActivate(): void;
  onDoubleActivate(): void;
}>) {
  const sourceId = boardSourceId(boardItem.id);
  const sourceNodeId = boardCellNodeId(boardItem.x, boardItem.y);

  return (
    <DraggableSurface
      id={sourceId}
      nodeId={`${sourceId}:drag`}
      payload={{
        sourceId,
        sourceNodeId,
        itemId: boardItem.itemId,
        source: { kind: "board", boardItemId: boardItem.id },
        overlay: { producer: boardItem.producer },
        hideWhenActive: true,
      } satisfies GameDragData}
      data-board-item-id={boardItem.id}
      hidden={hidden}
      className="absolute inset-0 touch-none"
      onSingleActivate={onSingleActivate}
      delaySingleWhenDouble={boardItem.producer?.doubleClickBehavior === "exhaust"}
      onDoubleActivate={onDoubleActivate}
    >
      <Tile item={item} producer={boardItem.producer} nowMs={nowMs} />
    </DraggableSurface>
  );
}
