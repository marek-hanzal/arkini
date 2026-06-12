import type { CSSProperties } from "react";
import { cn } from "~/lib/cn";
import type { ViewItem } from "~/domains/database";
import type { FlyerModel } from "../types";

export function Flyer({ flyer, item }: Readonly<{ flyer: FlyerModel; item: ViewItem }>) {
  const scale = flyer.from.width > 0 ? flyer.to.width / flyer.from.width : 1;

  return (
    <div
      className={cn("ak-fly pointer-events-none fixed", flyer.kind === "place" ? "z-10" : "z-50", `ak-fly--${flyer.kind}`)}
      style={{
        left: flyer.from.left,
        top: flyer.from.top,
        width: flyer.from.width,
        height: flyer.from.height,
        "--ak-x": `${flyer.to.left - flyer.from.left}px`,
        "--ak-y": `${flyer.to.top - flyer.from.top}px`,
        "--ak-scale": `${scale}`,
        "--ak-exit-y": `${flyer.to.top - flyer.from.top + 34}px`,
      } as CSSProperties}
    >
      <img src={item.assetSrc} alt="" className="h-full w-full object-contain" />
    </div>
  );
}
