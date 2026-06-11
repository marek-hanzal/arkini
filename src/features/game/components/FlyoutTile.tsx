import type { GameView } from "~/domains/database";
import { useEffect, useState } from "react";
import { stashAnimationMs } from "./constants";
import type { Flyout } from "./types";
import { TileContent } from "./TileContent";

export function FlyoutTile({ game, flyout }: Readonly<{ game: GameView; flyout: Flyout }>) {
  const [arrived, setArrived] = useState(false);
  const item = game.items[flyout.itemId];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setArrived(true));
    return () => window.cancelAnimationFrame(frame);
  }, [flyout.id]);

  if (!item) return null;

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
