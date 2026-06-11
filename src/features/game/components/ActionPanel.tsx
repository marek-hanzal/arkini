import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "~/lib/cn";
import { useGameView } from "~/hooks/useGameView";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export const ActionPanel = memo(function ActionPanel() {
  const game = useGameView((view) => ({ items: view.items, boardItemsById: view.boardItemsById }));
  const ui = useGameUiStore(
    useShallow((state) => {
      const boardItemId = state.selection?.type === "board" ? state.selection.boardItemId : null;
      return { boardItemId, invalidTargetId: state.invalidTargetId };
    }),
  );

  const selected = ui.boardItemId ? game.data?.boardItemsById[ui.boardItemId] : null;
  const item = selected ? game.data?.items[selected.itemId] : null;
  const invalid = selected ? ui.invalidTargetId === selected.id : false;

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Actions</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Drag items to move, merge, stash, or reorder inventory. Double-click an empty board cell to build from owned blueprints.
      </p>

      {item && selected ? (
        <div
          className={cn(
            "mt-3 rounded-sm bg-slate-950/60 p-3 transition",
            invalid && "bg-red-950/30 ring-1 ring-red-300",
          )}
        >
          <div className="flex items-center gap-3">
            <img src={item.assetSrc} alt="" className="h-10 w-10" />
            <div>
              <p className="font-semibold text-white">{item.name}</p>
              <p className="text-xs text-slate-400">{item.description}</p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Double-click producers to generate drops. Double-click regular board items to stash them.
          </p>
        </div>
      ) : null}
    </section>
  );
});
