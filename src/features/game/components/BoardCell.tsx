import { useDroppable } from "@dnd-kit/core";
import { memo, type MouseEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import type { GameView } from "~/domains/database";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { cellClass } from "./constants";
import { BuildHoverIcon } from "./BuildHoverIcon";
import { BoardItemCard } from "./BoardItemCard";
import { boardCellId, boardCellKey } from "./helpers/boardCellId";
import { getBoardCellDropState } from "./helpers/getBoardCellDropState";
import type { BoardItem, BuildCell, DropData, Selection } from "./types";

export const BoardCell = memo(function BoardCell({
  game,
  x,
  y,
  boardItem,
  pending,
  onSelect,
  onProduce,
  onStash,
  onOpenBuild,
}: Readonly<{
  game: GameView;
  x: number;
  y: number;
  boardItem: BoardItem | null;
  pending: boolean;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
  onOpenBuild(cell: BuildCell): void;
}>) {
  const key = boardCellKey(x, y);
  const dropId = boardCellId(x, y);
  const ui = useGameUiStore(
    useShallow((state) => ({
      activeDrag: state.activeDrag,
      selected: state.selection?.type === "board" && state.selection.boardItemId === boardItem?.id,
      invalid: state.invalidTargetId === dropId || state.invalidTargetId === boardItem?.id,
      committed: state.committedDrag?.type === "board" && state.committedDrag.boardItemId === boardItem?.id,
      hidden: Boolean(boardItem && state.hiddenBoardItemIds.has(boardItem.id)),
      mergePulse: state.mergePulseBoardItemId === boardItem?.id,
      boardPulse: state.boardPulseCell === key,
    })),
  );
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "board-cell", x, y, boardItemId: boardItem?.id } satisfies DropData,
    disabled: pending,
  });
  const visibleBoardItem = ui.committed || ui.hidden ? null : boardItem;
  const item = visibleBoardItem ? game.items[visibleBoardItem.itemId] : null;
  const dropState = isOver ? getBoardCellDropState(game, ui.activeDrag, boardItem) : "neutral";
  const empty = !boardItem;

  function handleEmptyDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (!empty || pending || ui.activeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenBuild({ x, y });
  }

  return (
    <div
      ref={setNodeRef}
      data-board-cell-id={key}
      onDoubleClick={handleEmptyDoubleClick}
      className={[
        cellClass,
        "group/cell relative bg-slate-950/80 shadow-inner shadow-black/30",
        empty && !pending && !ui.activeDrag ? "cursor-pointer hover:border-amber-300/60 hover:bg-amber-950/10" : "",
        ui.invalid
          ? "border-red-300 bg-red-950/40"
          : ui.boardPulse
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
      {empty && !ui.activeDrag ? <BuildHoverIcon /> : null}
      {visibleBoardItem && item ? (
        <BoardItemCard
          item={item}
          boardItem={visibleBoardItem}
          selected={ui.selected}
          pending={pending}
          mergePulse={ui.mergePulse}
          onSelect={() => onSelect({ type: "board", boardItemId: visibleBoardItem.id })}
          onProduce={() => onProduce(visibleBoardItem.id)}
          onStash={() => onStash(visibleBoardItem.id, visibleBoardItem.itemId)}
        />
      ) : null}
    </div>
  );
});
