import type { GameView } from "~/domains/database";
import type { Selection } from "./types";

export function ActionPanel({
  game,
  selection,
  invalidTargetId,
}: Readonly<{
  game: GameView;
  selection: Selection;
  pending: boolean;
  invalidTargetId: string | null;
}>) {
  const selectedBoardItem = selection?.type === "board" ? game.boardItems.find((item) => item.id === selection.boardItemId) : null;
  const selectedItem = selectedBoardItem ? game.items[selectedBoardItem.itemId] : null;
  const invalidSelection = selectedBoardItem ? invalidTargetId === selectedBoardItem.id : false;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Actions</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Drag items to move, merge, stash, or reorder inventory. Click an empty board cell to build from owned blueprints.
      </p>

      {selectedItem && selectedBoardItem ? (
        <div
          className={[
            "mt-3 rounded-xl bg-slate-950/60 p-3 transition",
            invalidSelection ? "ring-1 ring-red-300 bg-red-950/30" : "",
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
}
