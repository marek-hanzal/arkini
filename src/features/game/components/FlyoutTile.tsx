import { useEffect, useState } from "react";
import { useGameView } from "~/hooks/useGameView";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { stashAnimationMs } from "./constants";
import { TileContent } from "./TileContent";

export function FlyoutTile() {
  const game = useGameView((view) => ({ items: view.items }));
  const flyout = useGameUiStore((state) => state.flyout);
  const [arrived, setArrived] = useState(false);
  const item = flyout && game.data ? game.data.items[flyout.itemId] : null;

  useEffect(() => {
    if (!flyout) return;
    setArrived(false);
    const frame = window.requestAnimationFrame(() => setArrived(true));
    return () => window.cancelAnimationFrame(frame);
  }, [flyout?.id]);

  if (!flyout || !item) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-sky-300 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/80"
      style={{
        left: flyout.from.left,
        top: flyout.from.top,
        width: flyout.from.width,
        height: flyout.from.height,
        opacity: arrived ? 0.15 : 1,
        transform: arrived
          ? `translate(${flyout.to.left - flyout.from.left}px, ${flyout.to.top - flyout.from.top}px) scale(0.72)`
          : "translate(0, 0) scale(1)",
        transition: `transform ${stashAnimationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${stashAnimationMs}ms ease`,
      }}
    >
      <TileContent item={item} />
    </div>
  );
}
