import type { BuildRecipeId } from "~/domains/game-data";
import type { GameView } from "~/domains/database";
import type { BuildCell } from "../types";

export function BuildSheet({ game, cell, onClose, onBuild }: Readonly<{ game: GameView; cell: BuildCell | null; onClose(): void; onBuild(recipeId: BuildRecipeId): void }>) {
  if (!cell) return null;

  return (
    <>
      <button type="button" aria-label="Close build sheet" className="fixed inset-0 z-40 bg-slate-950/50" onClick={onClose} />
      <div
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        className="fixed inset-x-0 z-50 mx-auto max-w-[430px] rounded-t-lg border border-slate-800 bg-slate-950 p-4 shadow-2xl shadow-black/70"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-emerald-300">Build</p>
            <p className="text-sm text-slate-300">Cell {cell.x}:{cell.y}</p>
          </div>
          <button type="button" className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300" onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-2">
          {game.buildRecipes.map((recipe) => {
            const result = game.items[recipe.resultItemId];
            const blueprint = game.items[recipe.blueprintItemId];
            return (
              <button key={recipe.id} type="button" disabled={!recipe.canBuild} className="flex items-center gap-3 rounded-sm border border-slate-800 bg-slate-900/80 p-2 text-left disabled:opacity-40" onClick={() => onBuild(recipe.id)}>
                <img src={result.assetSrc} alt="" className="h-10 w-10 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-100">{result.name}</span>
                  <span className="block truncate text-xs text-slate-400">{blueprint.name} + {recipe.costs.map((cost) => `${cost.quantity}x ${game.items[cost.itemId]?.name ?? cost.itemId}`).join(", ")}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
