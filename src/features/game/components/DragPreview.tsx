import { memo } from "react";
import { match } from "ts-pattern";
import type { GameView } from "~/domains/database";
import { cn } from "~/lib/cn";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { isMergeFade } from "./helpers/isMergeFade";
import { TileContent } from "./TileContent";
import type { DragData } from "./types";

export namespace DragPreview {
  export interface Props {
    game: GameView;
    drag: DragData;
  }
}

export const DragPreview = memo(function DragPreview({ game, drag }: Readonly<DragPreview.Props>) {
  const overId = useGameUiStore((state) => state.activeOverId);
  const faded = isMergeFade(game, drag, overId);
  const item = match(drag)
    .with({ type: "inventory" }, ({ slotIndex }) => {
      const stack = game.inventoryBySlotIndex[slotIndex]?.stack;
      return stack ? game.items[stack.itemId] : null;
    })
    .with({ type: "board" }, ({ boardItemId }) => {
      const boardItem = game.boardItemsById[boardItemId];
      return boardItem ? game.items[boardItem.itemId] : null;
    })
    .exhaustive();

  if (!item) return null;

  return (
    <div
      className={cn(
        "h-[6.25rem] w-[6.25rem] rounded-sm border border-emerald-300 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/80 transition-opacity duration-200 will-change-[opacity]",
        faded && "opacity-35",
      )}
    >
      <TileContent item={item} />
    </div>
  );
});
