import { useDroppable } from "@dnd-kit/core";
import { memo } from "react";
import type { GameView } from "~/domains/database";
import { cellClass } from "./constants";
import { InventoryItemCard } from "./InventoryItemCard";
import type { DragData, DropData, InventorySlot } from "./types";

export const InventorySlotCell = memo(function InventorySlotCell({
  game,
  slot,
  pending,
  invalidTargetId,
  committedDrag,
  preview,
  pulse,
  onPlaceStack,
}: Readonly<{
  game: GameView;
  slot: InventorySlot;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  preview: boolean;
  pulse: boolean;
  onPlaceStack(slotIndex: number, itemId: string): void;
}>) {
  const dropId = `inventory:${slot.slotIndex}`;
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData,
    disabled: pending,
  });
  const sourceCommitted = committedDrag?.type === "inventory" && committedDrag.slotIndex === slot.slotIndex;
  const visibleStack = sourceCommitted ? null : slot.stack;
  const item = visibleStack ? game.items[visibleStack.itemId] : null;
  const invalid = invalidTargetId === dropId;

  return (
    <div
      ref={setNodeRef}
      data-inventory-slot-index={slot.slotIndex}
      className={[
        cellClass,
        "relative bg-slate-950/80",
        invalid
          ? "border-red-300 bg-red-950/40"
          : pulse
            ? "border-sky-200 bg-sky-500/20 ring-2 ring-sky-300/50"
            : preview
              ? "border-sky-300 bg-sky-950/40"
              : isOver
                ? "border-slate-500 bg-slate-900/60"
                : "border-slate-800",
      ].join(" ")}
    >
      {item && visibleStack ? (
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
