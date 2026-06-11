import { memo } from "react";
import { cn } from "~/lib/cn";
import { useGameView } from "~/hooks/useGameView";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export namespace BuildModal {
  export interface Props {
    pending: boolean;
    onClose(): void;
    onBuild(recipeId: string): void;
  }
}

export const BuildModal = memo(function BuildModal({ pending, onClose, onBuild }: Readonly<BuildModal.Props>) {
  const game = useGameView((view) => ({ buildRecipes: view.buildRecipes, inventory: view.inventory, items: view.items }));
  const cell = useGameUiStore((state) => state.buildCell);
  if (!cell || !game.data) return null;

  const ownedBlueprintIds = new Set(game.data.inventory.flatMap((slot) => (slot.stack ? [slot.stack.itemId] : [])));
  const recipes = game.data.buildRecipes.filter((recipe) => ownedBlueprintIds.has(recipe.blueprintItemId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[75vh] w-full max-w-lg flex-col rounded-md border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-slate-950/70"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Build</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Choose blueprint</h2>
            <p className="mt-1 text-sm text-slate-400">
              Target cell {cell.x + 1}, {cell.y + 1}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-slate-950 px-3 py-1 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {recipes.length ? (
          <div className="mt-4 grid min-h-0 gap-3 overflow-y-auto pr-1">
            {recipes.map((recipe) => {
              const result = game.data.items[recipe.resultItemId];
              const blueprint = game.data.items[recipe.blueprintItemId];
              return (
                <button
                  key={recipe.id}
                  type="button"
                  disabled={pending || !recipe.canBuild}
                  onClick={() => onBuild(recipe.id)}
                  className={cn(
                    "rounded-sm border p-3 text-left transition",
                    recipe.canBuild
                      ? "border-amber-300/40 bg-amber-300/10 hover:bg-amber-300/15"
                      : "border-slate-800 bg-slate-950/50 opacity-50",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <img src={result.assetSrc} alt="" className="h-12 w-12" />
                    <div>
                      <p className="font-semibold text-white">{result.name}</p>
                      <p className="text-xs text-slate-400">Consumes {blueprint.name}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {recipe.costs.map((cost) => `${game.data.items[cost.itemId].name} × ${cost.quantity}`).join(", ")}
                  </p>
                  {!recipe.canBuild ? <p className="mt-2 text-xs text-red-200">Missing materials.</p> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-sm border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm leading-6 text-slate-400">
            No blueprints in inventory. Make a producer cough one up first, because apparently civilization starts with paperwork.
          </div>
        )}
      </div>
    </div>
  );
});
