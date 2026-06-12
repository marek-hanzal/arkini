import type { BuildRecipeId } from "~/domains/game-data";
import type { GameView } from "~/domains/database";
import type { BuildCell } from "../types";

export function BuildSheet({ game, cell, onClose, onBuild }: Readonly<{ game: GameView; cell: BuildCell | null; onClose(): void; onBuild(recipeId: BuildRecipeId): void }>) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-emerald-300">Build</p>
          <p className="text-sm text-slate-300">{cell ? `Cell ${cell.x}:${cell.y}` : "Choose an empty board cell"}</p>
        </div>
        <button type="button" className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300" onClick={onClose}>Close</button>
      </div>

      {cell ? (
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
      ) : (
        <p className="rounded-sm border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">Double-click an empty board cell to build there.</p>
      )}
    </div>
  );
}
