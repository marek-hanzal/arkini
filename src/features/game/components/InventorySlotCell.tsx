import { useDroppable } from "@dnd-kit/core";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { GameView } from "~/domains/database";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { cellClass } from "./constants";
import { getInventoryPreviewSlot } from "./helpers/getInventoryPreviewSlot";
import { InventoryItemCard } from "./InventoryItemCard";
import type { DropData, InventorySlot } from "./types";

export const InventorySlotCell = memo(function InventorySlotCell({
  game,
  slot,
  pending,
  onPlaceStack,
}: Readonly<{
  game: GameView;
  slot: InventorySlot;
  pending: boolean;
  onPlaceStack(slotIndex: number, itemId: string): void;
}>) {
  const dropId = `inventory:${slot.slotIndex}`;
  const ui = useGameUiStore(
    useShallow((state) => {
      const previewSlotIndex = getInventoryPreviewSlot(game, state.activeDrag, state.activeOverId, Date.now());
      return {
        invalid: state.invalidTargetId === dropId,
        pulse: state.inventoryPulseSlot === slot.slotIndex,
        committed: state.committedDrag?.type === "inventory" && state.committedDrag.slotIndex === slot.slotIndex,
        preview: previewSlotIndex === slot.slotIndex,
      };
    }),
  );
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData,
    disabled: pending,
  });
  const visibleStack = ui.committed ? null : slot.stack;
  const item = visibleStack ? game.items[visibleStack.itemId] : null;

  return (
    <div
      ref={setNodeRef}
      className={[
        cellClass,
        "relative bg-slate-950/80 shadow-inner shadow-black/30",
        ui.invalid
          ? "border-red-300 bg-red-950/40"
          : ui.pulse
            ? "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50"
            : ui.preview
              ? "border-sky-200 bg-sky-950/40"
              : isOver
                ? "border-sky-300 bg-sky-950/30"
                : "border-slate-800",
      ].join(" ")}
    >
      {visibleStack && item ? (
        <InventoryItemCard
          item={item}
          quantity={visibleStack.quantity}
          slotIndex={slot.slotIndex}
          pending={pending}
          onPlace={() => onPlaceStack(slot.slotIndex, visibleStack.itemId)}
        />
      ) : null}
    </div>
  );
});
