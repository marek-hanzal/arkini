import type { GameView } from "@arkini/db";
import { match } from "ts-pattern";
import type { DragData } from "./types";
import { TileContent } from "./TileContent";

export function DragPreview({ game, drag, faded }: Readonly<{ game: GameView; drag: DragData; faded: boolean }>) {
  const item = match(drag)
    .with({ type: "inventory" }, ({ slotIndex }) => {
      const stack = game.inventory.find((slot) => slot.slotIndex === slotIndex)?.stack;
      return stack ? game.items[stack.itemId] : null;
    })
    .with({ type: "board" }, ({ boardItemId }) => {
      const boardItem = game.boardItems.find((candidate) => candidate.id === boardItemId);
      return boardItem ? game.items[boardItem.itemId] : null;
    })
    .with({ type: "build" }, ({ recipeId }) => {
      const recipe = game.buildRecipes.find((candidate) => candidate.id === recipeId);
      return recipe ? game.items[recipe.resultItemId] : null;
    })
    .exhaustive();

  if (!item) return null;

  return (
    <div
      className="h-24 w-24 rounded-2xl border border-emerald-300 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/80 will-change-[opacity]"
      style={{ opacity: faded ? 0.35 : 1, transition: "opacity 220ms ease-out" }}
    >
      <TileContent item={item} />
    </div>
  );
}
