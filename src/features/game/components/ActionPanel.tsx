import type { GameView } from "~/domains/database";
import { useDraggable } from "@dnd-kit/core";
import type { DragData, Selection } from "./types";

export function ActionPanel({
  game,
  selection,
  pending,
  invalidTargetId,
  committedDrag,
  onReset,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  onReset(): void;
}>) {
  const selectedBoardItem = selection?.type === "board" ? game.boardItems.find((item) => item.id === selection.boardItemId) : null;
  const selectedItem = selectedBoardItem ? game.items[selectedBoardItem.itemId] : null;
  const invalidSelection = selectedBoardItem ? invalidTargetId === selectedBoardItem.id : false;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Actions</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Drag-first controls</h2>
      <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">
        Drag inventory items onto empty board cells. Drag board items onto empty cells to move, matching merge targets to combine, or the inventory to store.
      </p>

      {selectedItem && selectedBoardItem ? (
        <div
          className={[
            "mt-4 rounded-2xl border bg-slate-950/70 p-4 transition",
            invalidSelection ? "border-red-300 bg-red-950/30" : "border-slate-800",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <img src={selectedItem.assetSrc} alt="" className="h-12 w-12" />
            <div>
              <p className="font-semibold text-white">{selectedItem.name}</p>
              <p className="text-xs text-slate-400">{selectedItem.description}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Double-click producers to drop items. Double-click regular board items to send them to inventory.
          </p>
        </div>
      ) : null}

      <BuildPanel game={game} pending={pending} committedDrag={committedDrag} />

      <button
        type="button"
        disabled={pending}
        onClick={onReset}
        className="mt-4 w-full rounded-2xl border border-red-400/30 bg-red-950/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-50"
      >
        Reset save
      </button>
    </section>
  );
}

function BuildPanel({
  game,
  pending,
  committedDrag,
}: Readonly<{
  game: GameView;
  pending: boolean;
  committedDrag: DragData | null;
}>) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-white">Blueprint builds</p>
      <div className="mt-3 grid gap-3">
        {game.buildRecipes.map((recipe) => (
          <BuildRecipeCard key={recipe.id} game={game} recipe={recipe} pending={pending} committedDrag={committedDrag} />
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Drag a build card onto an empty board cell. Crafting consumes the blueprint and inventory materials.</p>
    </div>
  );
}

function BuildRecipeCard({
  game,
  recipe,
  pending,
  committedDrag,
}: Readonly<{
  game: GameView;
  recipe: GameView["buildRecipes"][number];
  pending: boolean;
  committedDrag: DragData | null;
}>) {
  const result = game.items[recipe.resultItemId];
  const blueprint = game.items[recipe.blueprintItemId];
  const hidden = committedDrag?.type === "build" && committedDrag.recipeId === recipe.id;
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `build:${recipe.id}`,
    data: { type: "build", recipeId: recipe.id } satisfies DragData,
    disabled: pending || !recipe.canBuild,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "rounded-2xl border p-3 text-left transition",
        recipe.canBuild ? "cursor-grab border-slate-800 bg-slate-900/60 hover:border-amber-300 active:cursor-grabbing" : "border-slate-800 bg-slate-950/40 opacity-40",
        hidden || isDragging ? "opacity-0" : "",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-3">
        <img src={result.assetSrc} alt="" className="h-10 w-10" />
        <div>
          <p className="font-semibold text-slate-100">Build {result.name}</p>
          <p className="text-xs text-slate-400">Consumes {blueprint.name}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {recipe.costs.map((cost) => `${game.items[cost.itemId].name} × ${cost.quantity}`).join(", ")}
      </p>
    </div>
  );
}
