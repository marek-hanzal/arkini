import { useEffect, useRef } from "react";
import { cn } from "~/lib/cn";
import type { ViewItem } from "~/domains/database";
import type { FlyerModel } from "../types";
import { playFlyerTimeline } from "../utils/animation";
import { Tile } from "./Tile";

export function Flyer({ flyer, item, nowMs, onSettle }: Readonly<{ flyer: FlyerModel; item: ViewItem; nowMs: number; onSettle(id: string): void }>) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let disposed = false;
    void playFlyerTimeline(element, flyer).then(() => {
      if (!disposed) onSettle(flyer.id);
    });

    return () => {
      disposed = true;
    };
  }, [flyer, onSettle]);

  return (
    <div
      ref={ref}
      className={cn("ak-fly pointer-events-none fixed", flyer.kind === "place" ? "z-10" : "z-50", `ak-fly--${flyer.kind}`)}
      style={{
        left: flyer.from.left,
        top: flyer.from.top,
        width: flyer.from.width,
        height: flyer.from.height,
      }}
    >
      <Tile item={item} quantity={flyer.quantity} producer={flyer.producer ?? undefined} nowMs={nowMs} />
    </div>
  );
}
