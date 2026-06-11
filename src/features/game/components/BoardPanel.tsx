import { memo, useMemo } from "react";
import type { GameView } from "~/domains/database";
import { cellSize } from "./constants";
import { BoardCell } from "./BoardCell";
import { boardCellKey } from "./helpers/boardCellId";
import type { BuildCell, DragData, Selection } from "./types";

export const BoardPanel = memo(function BoardPanel({
  game,
  selection,
  activeDrag,
  pending,
  invalidTargetId,
  committedDrag,
  hiddenBoardItemIds,
  mergePulseBoardItemId,
  boardPulseCell,
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
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
  onOpenBuild(cell: BuildCell): void;
}>) {
  const itemByCell = useMemo(
    () => new Map(game.boardItems.map((item) => [boardCellKey(item.x, item.y), item])),
    [game.boardItems],
  );
  const cells = useMemo(
    () =>
      Array.from({ length: game.save.boardWidth * game.save.boardHeight }, (_, index) => ({
        x: index % game.save.boardWidth,
        y: Math.floor(index / game.save.boardWidth),
      })),
    [game.save.boardHeight, game.save.boardWidth],
  );

  return (
    <section className="w-fit max-w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Board</p>
          <h2 className="text-base font-semibold text-white">Merge space</h2>
        </div>
        <p className="rounded-sm bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400">
          {game.save.boardWidth}×{game.save.boardHeight}
        </p>
      </div>

      <div className="grid w-fit gap-0 overflow-hidden rounded-sm border border-slate-800" style={{ gridTemplateColumns: `repeat(${game.save.boardWidth}, ${cellSize})` }}>
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
});
