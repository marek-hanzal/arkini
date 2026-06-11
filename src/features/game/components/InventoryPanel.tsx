import { memo } from "react";
import type { GameView } from "~/domains/database";
import { cellSize } from "./constants";
import { InventorySlotCell } from "./InventorySlotCell";

export const InventoryPanel = memo(function InventoryPanel({
  game,
  pending,
  onPlaceStack,
}: Readonly<{
  game: GameView;
  pending: boolean;
  onPlaceStack(slotIndex: number, itemId: string): void;
}>) {
  const columns = 4;

  return (
    <section className="w-fit max-w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">Inventory</p>
          <h2 className="text-base font-semibold text-white">Stack storage</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">{game.inventory.length} slots</p>
      </div>
      <div className="mt-3 grid w-fit gap-0 overflow-hidden rounded-sm border border-slate-800" style={{ gridTemplateColumns: `repeat(${columns}, ${cellSize})` }}>
        {game.inventory.map((slot) => (
          <InventorySlotCell key={slot.slotIndex} game={game} slot={slot} pending={pending} onPlaceStack={onPlaceStack} />
        ))}
      </div>
    </section>
  );
});
