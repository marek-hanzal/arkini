import { memo } from "react";
import type { ViewItem } from "./types";

export const TileContent = memo(function TileContent({ item }: Readonly<{ item: ViewItem }>) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
      <img src={item.assetSrc} alt="" className="h-12 w-12" />
      <span className="line-clamp-1 max-w-full text-[0.7rem] font-medium leading-tight text-slate-200">{item.name}</span>
    </div>
  );
});
