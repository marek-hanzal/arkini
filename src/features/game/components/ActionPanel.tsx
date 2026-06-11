import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { GameView } from "~/domains/database";
import { useGameUiStore } from "~/features/game/state/gameUiStore";

export const ActionPanel = memo(function ActionPanel({ game }: Readonly<{ game: GameView; pending: boolean }>) {
  const ui = useGameUiStore(
    useShallow((state) => {
      const selectedBoardItem = state.selection?.type === "board" ? game.boardItemsById[state.selection.boardItemId] : null;
      return {
        selectedBoardItem,
        invalidSelection: selectedBoardItem ? state.invalidTargetId === selectedBoardItem.id : false,
      };
    }),
  );
  const selectedItem = ui.selectedBoardItem ? game.items[ui.selectedBoardItem.itemId] : null;

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Actions</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Drag items to move, merge, stash, or reorder inventory. Double-click an empty board cell to build from owned blueprints.
      </p>

      {selectedItem && ui.selectedBoardItem ? (
        <div
          className={[
            "mt-3 rounded-sm bg-slate-950/60 p-3 transition",
            ui.invalidSelection ? "ring-1 ring-red-300 bg-red-950/30" : "",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <img src={selectedItem.assetSrc} alt="" className="h-10 w-10" />
            <div>
              <p className="font-semibold text-white">{selectedItem.name}</p>
              <p className="text-xs text-slate-400">{selectedItem.description}</p>
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
