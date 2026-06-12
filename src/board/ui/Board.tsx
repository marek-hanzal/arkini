import { useMemo, useRef, type ReactNode } from "react";
import { resolveItemMergeRule } from "~/manifest/data/resolveItemMergeRule";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { ItemId } from "~/manifest/data/manifestId";
import { cn } from "~/shared/cn";
import { cellKey } from "~/board/util/cell";
import {
  boardCellNodeId,
  boardColumns,
  boardContainerNodeId,
  type BoardCell,
  boardRows,
  boardSourceId,
} from "~/board/boardIdentity";
import type { GameDragData, GameDropData } from "~/play/types";
import { usePressActions } from "~/shared/hook/usePressActions";
import { useGsapCellFeedback } from "~/board/hook/useGsapCellFeedback";
import { useDelayedMergeHints } from "~/board/hook/useDelayedMergeHints";
import { DraggableSurface, DroppableSurface } from "~/drag/ui/DragSurface";
import { Tile } from "~/item/ui/Tile";
import { useProducerNow } from "~/producer/hook/useProducerNow";

export namespace Board {
  export interface DragState {
    activeDrag: GameDragData | null;
    isSourceHidden(sourceId: string): boolean;
  }

  export interface FeedbackState {
    invalidCellKey: string | null;
    mergedCellKey: string | null;
  }

  export interface Actions {
    emptyDoubleActivate(cell: BoardCell): void;
    tileSingleActivate(item: BoardViewItem): void;
    tileDoubleActivate(item: BoardViewItem): void;
  }

  export interface Props {
    drag: DragState;
    feedback: FeedbackState;
    actions: Actions;
  }
}

export function Board({ drag, feedback, actions }: Board.Props) {
  const board = usePlayBoard().data;
  const items = usePlayItems().data;
  const cells = useMemo(() => Array.from({ length: boardColumns * boardRows }, (_, index) => ({ x: index % boardColumns, y: Math.floor(index / boardColumns) })), []);
  const showMergeHints = useDelayedMergeHints({ activeDrag: drag.activeDrag });

  if (!board || !items) return null;

  return (
    <div
      data-drag-boundary-id={boardContainerNodeId}
      className="grid w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40"
      style={{ gridTemplateColumns: `repeat(${boardColumns}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => {
        const key = cellKey(cell.x, cell.y);
        const boardItem = board.byCellKey[key] ?? null;
        const viewItem = boardItem ? items[boardItem.itemId] : null;
        const canMerge = showMergeHints && drag.activeDrag?.source.kind === "board" && boardItem && boardItem.id !== drag.activeDrag.source.boardItemId
          ? Boolean(resolveItemMergeRule(drag.activeDrag.itemId as ItemId, boardItem.itemId as ItemId))
          : false;
        return (
          <BoardCell
            key={key}
            x={cell.x}
            y={cell.y}
            boardItem={boardItem}
            canMerge={canMerge}
            invalid={feedback.invalidCellKey === key}
            merged={feedback.mergedCellKey === key}
            onEmptyDoubleActivate={actions.emptyDoubleActivate}
          >
            {boardItem && viewItem ? (
              <BoardTile
                boardItem={boardItem}
                item={viewItem}
                hidden={drag.isSourceHidden(boardSourceId(boardItem.id))}
                onSingleActivate={() => actions.tileSingleActivate(boardItem)}
                onDoubleActivate={() => actions.tileDoubleActivate(boardItem)}
              />
            ) : null}
          </BoardCell>
        );
      })}
    </div>
  );
}

namespace BoardCell {
  export interface Props {
    x: number;
    y: number;
    boardItem: BoardViewItem | null;
    canMerge: boolean;
    invalid: boolean;
    merged: boolean;
    children: ReactNode;
    onEmptyDoubleActivate(cell: BoardCell): void;
  }
}

function BoardCell({
  x,
  y,
  boardItem,
  canMerge,
  invalid,
  merged,
  children,
  onEmptyDoubleActivate,
}: BoardCell.Props) {
  const id = boardCellNodeId(x, y);
  const cellRef = useRef<HTMLDivElement | null>(null);
  const producerReady = useProducerReady(boardItem?.producer ?? null);
  const press = usePressActions({
    onDouble: () => {
      if (!boardItem) onEmptyDoubleActivate({ x, y });
    },
  });
  useGsapCellFeedback(cellRef, { invalid, success: merged || producerReady });

  return (
    <DroppableSurface
      id={id}
      nodeId={id}
      payload={{ targetId: id, targetNodeId: id, target: { kind: "cell", x, y, boardItemId: boardItem?.id ?? null } } satisfies GameDropData}
      nodeRef={(node) => { cellRef.current = node; }}
      data-board-cell={`${x}:${y}`}
      data-board-item-id={boardItem?.id}
      className={(isOver) => cn(
        "ak-board-cell relative aspect-square touch-none border-b border-r border-slate-800/80 bg-slate-900/55",
        x === boardColumns - 1 && "border-r-0",
        y === boardRows - 1 && "border-b-0",
        isOver && !canMerge && "bg-slate-800/80",
        canMerge && "ak-merge-target",
        canMerge && isOver && "ak-merge-target-over",
        invalid && "ak-cell-error",
      )}
      {...press.pressProps}
    >
      {children}
    </DroppableSurface>
  );
}

function useProducerReady(producer: BoardViewItem["producer"]) {
  const nowMs = useProducerNow(producer);
  if (!producer) return false;

  const cooldownUntil = producer.cooldownUntil ? Date.parse(producer.cooldownUntil) : 0;
  const hasCharges = producer.remainingCharges === null || producer.remainingCharges === undefined || producer.remainingCharges > 0;
  return hasCharges && cooldownUntil <= nowMs;
}

namespace BoardTile {
  export interface Props {
    boardItem: BoardViewItem;
    item: ViewItem;
    hidden: boolean;
    onSingleActivate(): void;
    onDoubleActivate(): void;
  }
}

function BoardTile({
  boardItem,
  item,
  hidden,
  onSingleActivate,
  onDoubleActivate,
}: BoardTile.Props) {
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
      <Tile item={item} producer={boardItem.producer} />
    </DraggableSurface>
  );
}
