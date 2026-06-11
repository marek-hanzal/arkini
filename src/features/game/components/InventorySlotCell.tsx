import { useDroppable } from "@dnd-kit/core";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { GameView } from "~/domains/database";
import { cn } from "~/lib/cn";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { cellClass } from "./constants";
import { getPreviewSlot } from "./helpers/getPreviewSlot";
import { InventoryTile } from "./InventoryTile";
import type { DropData, InventorySlot } from "./types";

export namespace InventorySlotCell {
  export interface Props {
    game: GameView;
    slot: InventorySlot;
    pending: boolean;
    onPlaceStack(slotIndex: number, itemId: string): void;
  }
}

export const InventorySlotCell = memo(function InventorySlotCell({
  game,
  slot,
  pending,
  onPlaceStack,
}: Readonly<InventorySlotCell.Props>) {
  const id = `inventory:${slot.slotIndex}`;
  const ui = useGameUiStore(
    useShallow((state) => {
      const preview = getPreviewSlot(game, state.activeDrag, state.activeOverId, Date.now());
      return {
        invalid: state.invalidTargetId === id,
        pulse: state.inventoryPulseSlot === slot.slotIndex,
        committed: state.committedDrag?.type === "inventory" && state.committedDrag.slotIndex === slot.slotIndex,
        preview: preview === slot.slotIndex,
      };
    }),
  );
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { type: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData,
    disabled: pending,
  });
  const visible = ui.committed ? null : slot.stack;
  const item = visible ? game.items[visible.itemId] : null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        cellClass,
        "relative bg-slate-950/80 shadow-inner shadow-black/30",
        ui.invalid && "border-red-300 bg-red-950/40",
        ui.pulse && "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50",
        ui.preview && "border-sky-200 bg-sky-950/40",
        isOver && "border-sky-300 bg-sky-950/30",
        !ui.invalid && !ui.pulse && !ui.preview && !isOver && "border-slate-800",
      )}
    >
      {visible && item ? (
        <InventoryTile
          item={item}
          quantity={visible.quantity}
          slotIndex={slot.slotIndex}
          pending={pending}
          onPlace={() => onPlaceStack(slot.slotIndex, visible.itemId)}
        />
      ) : null}
    </div>
  );
});
