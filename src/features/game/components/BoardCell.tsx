import { useDroppable } from "@dnd-kit/core";
import { memo, type MouseEvent } from "react";
import { match } from "ts-pattern";
import { useShallow } from "zustand/react/shallow";
import type { GameView } from "~/domains/database";
import { cn } from "~/lib/cn";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { cellClass } from "./constants";
import { BuildHoverIcon } from "./BuildHoverIcon";
import { BoardTile } from "./BoardTile";
import { cellId } from "./helpers/cellId";
import { cellKey } from "./helpers/cellKey";
import { getDropState } from "./helpers/getDropState";
import type { BoardItem, BuildCell, DropData, Selection } from "./types";

export namespace BoardCell {
  export interface Props {
    game: GameView;
    x: number;
    y: number;
    boardItem: BoardItem | null;
    pending: boolean;
    onSelect(selection: Selection): void;
    onProduce(boardItemId: string): void;
    onStash(boardItemId: string, itemId: string): void;
    onOpenBuild(cell: BuildCell): void;
  }
}

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
}: Readonly<BoardCell.Props>) {
  const key = cellKey(x, y);
  const id = cellId(x, y);
  const ui = useGameUiStore(
    useShallow((state) => ({
      drag: state.activeDrag,
      selected: state.selection?.type === "board" && state.selection.boardItemId === boardItem?.id,
      invalid: state.invalidTargetId === id || state.invalidTargetId === boardItem?.id,
      committed: state.committedDrag?.type === "board" && state.committedDrag.boardItemId === boardItem?.id,
      hidden: Boolean(boardItem && state.hiddenBoardItemIds.has(boardItem.id)),
      mergePulse: state.mergePulseBoardItemId === boardItem?.id,
      boardPulse: state.boardPulseCell === key,
    })),
  );
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: "board-cell", x, y, boardItemId: boardItem?.id } satisfies DropData,
    disabled: pending,
  });
  const visible = ui.committed || ui.hidden ? null : boardItem;
  const item = visible ? game.items[visible.itemId] : null;
  const drop = isOver ? getDropState(game, ui.drag, boardItem) : "neutral";
  const empty = !boardItem;

  function openBuild(event: MouseEvent<HTMLDivElement>) {
    if (!empty || pending || ui.drag) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenBuild({ x, y });
  }

  return (
    <div
      ref={setNodeRef}
      data-board-cell-id={key}
      onDoubleClick={openBuild}
      className={cn(
        cellClass,
        "group/cell relative bg-slate-950/80 shadow-inner shadow-black/30",
        empty && !pending && !ui.drag && "cursor-pointer hover:border-amber-300/60 hover:bg-amber-950/10",
        match({ drop, invalid: ui.invalid, item, pulse: ui.boardPulse })
          .with({ invalid: true }, () => "border-red-300 bg-red-950/40")
          .with({ pulse: true }, () => "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50")
          .with({ drop: "valid" }, () => "border-emerald-300 bg-emerald-950/40")
          .with({ drop: "invalid" }, () => "border-red-300 bg-red-950/40")
          .when(({ item }) => item?.canProduce === true, () => "border-amber-400/30 bg-amber-950/10")
          .otherwise(() => "border-slate-800"),
      )}
    >
      {empty && !ui.drag ? <BuildHoverIcon /> : null}
      {visible && item ? (
        <BoardTile
          item={item}
          boardItem={visible}
          selected={ui.selected}
          pending={pending}
          mergePulse={ui.mergePulse}
          onSelect={() => onSelect({ type: "board", boardItemId: visible.id })}
          onProduce={() => onProduce(visible.id)}
          onStash={() => onStash(visible.id, visible.itemId)}
        />
      ) : null}
    </div>
  );
});
