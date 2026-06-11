import type { CSSProperties } from "react";
import type { ViewItem } from "~/domains/database";
import type { FlyerModel } from "../types";

export function Flyer({ flyer, item }: Readonly<{ flyer: FlyerModel; item: ViewItem }>) {
  const scale = flyer.from.width > 0 ? flyer.to.width / flyer.from.width : 1;

  return (
    <div
      className="ak-fly pointer-events-none fixed z-50"
      style={{
        left: flyer.from.left,
        top: flyer.from.top,
        width: flyer.from.width,
        height: flyer.from.height,
        "--ak-x": `${flyer.to.left - flyer.from.left}px`,
        "--ak-y": `${flyer.to.top - flyer.from.top}px`,
        "--ak-scale": `${scale}`,
      } as CSSProperties}
    >
      <img src={item.assetSrc} alt="" className="h-full w-full object-contain" />
    </div>
  );
}
