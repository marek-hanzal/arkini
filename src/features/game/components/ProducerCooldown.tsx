import { memo } from "react";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { getCooldown } from "./helpers/getCooldown";
import type { BoardItem, ViewItem } from "./types";

export const ProducerCooldown = memo(function ProducerCooldown({ item, boardItem }: Readonly<{ item: ViewItem; boardItem: BoardItem }>) {
  const nowMs = useGameUiStore((state) => state.nowMs);
  const cooldown = getCooldown(item, boardItem, nowMs);

  if (!cooldown.coolingDown) return null;

  return (
    <>
      <div
        className="absolute inset-x-0 bottom-0 origin-bottom bg-amber-300/25 transition-transform duration-200 ease-linear will-change-transform"
        style={{ transform: `scaleY(${cooldown.progress})` }}
      />
      <span className="absolute right-1 top-1 z-20 rounded-sm bg-slate-950/85 px-1.5 text-[0.58rem] font-bold text-amber-100">
        {Math.ceil(cooldown.remainingMs / 1000)}s
      </span>
    </>
  );
});
