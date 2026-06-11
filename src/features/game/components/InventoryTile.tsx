import { useDraggable } from "@dnd-kit/core";
import { memo, type MouseEvent } from "react";
import { cn } from "~/lib/cn";
import { TileContent } from "./TileContent";
import type { DragData, ViewItem } from "./types";

export namespace InventoryTile {
  export interface Props {
    item: ViewItem;
    quantity: number;
    slotIndex: number;
    pending: boolean;
    onPlace(): void;
  }
}

export const InventoryTile = memo(function InventoryTile({
  item,
  quantity,
  slotIndex,
  pending,
  onPlace,
}: Readonly<InventoryTile.Props>) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `inventory-item:${slotIndex}`,
    data: { type: "inventory", slotIndex } satisfies DragData,
    disabled: pending,
  });

  function doubleClick(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    onPlace();
  }

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={doubleClick}
      className={cn(
        "flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 rounded-sm transition active:cursor-grabbing",
        isDragging ? "opacity-0" : "hover:bg-slate-800/70",
      )}
      {...listeners}
      {...attributes}
    >
      <TileContent item={item} />
      <span className="absolute bottom-1 right-1.5 rounded-sm bg-slate-900 px-1.5 text-[0.7rem] font-bold text-slate-100">
        {quantity}
      </span>
    </div>
  );
});
