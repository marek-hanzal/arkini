import { useDroppable } from "@dnd-kit/core";
import { memo, type MouseEvent } from "react";
import type { GameView } from "~/domains/database";
import { cellClass } from "./constants";
import { BuildHoverIcon } from "./BuildHoverIcon";
import { BoardItemCard } from "./BoardItemCard";
import { boardCellId, boardCellKey } from "./helpers/boardCellId";
import { getBoardCellDropState } from "./helpers/getBoardCellDropState";
import type { BoardItem, BuildCell, DragData, DropData, Selection } from "./types";

export const BoardCell = memo(function BoardCell({
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

  function handleEmptyDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (!empty || pending || activeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenBuild({ x, y });
  }

  return (
    <div
      ref={setNodeRef}
      data-board-cell-id={boardCellKey(x, y)}
      onDoubleClick={handleEmptyDoubleClick}
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
          onSelect={() => onSelect({ type: "board", boardItemId: visibleBoardItem.id })}
          onProduce={() => onProduce(visibleBoardItem.id)}
          onStash={() => onStash(visibleBoardItem.id, visibleBoardItem.itemId)}
        />
      ) : null}
    </div>
  );
});
