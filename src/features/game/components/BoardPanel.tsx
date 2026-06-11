import { memo, useMemo } from "react";
import type { GameView } from "~/domains/database";
import { cellSize } from "./constants";
import { BoardCell } from "./BoardCell";
import { cellKey } from "./helpers/cellKey";
import type { BuildCell, Selection } from "./types";

export const BoardPanel = memo(function BoardPanel({
  game,
  pending,
  onSelect,
  onProduce,
  onStash,
  onOpenBuild,
}: Readonly<{
  game: GameView;
  pending: boolean;
  onSelect(selection: Selection): void;
  onProduce(boardItemId: string): void;
  onStash(boardItemId: string, itemId: string): void;
  onOpenBuild(cell: BuildCell): void;
}>) {
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
          const key = cellKey(cell.x, cell.y);
          return (
            <BoardCell
              key={key}
              game={game}
              x={cell.x}
              y={cell.y}
              boardItem={game.boardItemByCellKey[key] ?? null}
              pending={pending}
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
