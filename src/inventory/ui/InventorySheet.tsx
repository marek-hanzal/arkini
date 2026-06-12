import { useRef } from "react";
import type { InventorySlot, GameView, ViewItem } from "~/play/logic/playTypes";
import { cn } from "~/shared/cn";
import {
  inventoryContainerNodeId,
  inventoryColumns,
  inventorySlots,
  inventorySlotNodeId,
  inventorySourceId,
} from "~/inventory/inventoryIdentity";
import type { GameDragData, GameDropData } from "~/play/types";
import { useGsapCellFeedback } from "~/board/hook/useGsapCellFeedback";
import { DraggableSurface, DroppableSurface } from "~/drag/ui/DragSurface";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { Tile } from "~/item/ui/Tile";

export function InventorySheet({
  game,
  isSourceHidden,
  invalidInventorySlot,
  onClose,
  onSlotDoubleActivate,
}: Readonly<{
  game: GameView;
  isSourceHidden(sourceId: string): boolean;
  invalidInventorySlot: number | null;
  onClose(): void;
  onSlotDoubleActivate(slot: InventorySlot): void;
}>) {
  const inventory = game.inventory.slice(0, inventorySlots);
  const filled = inventory.filter((slot) => slot.stack).length;

  return (
    <div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
      <SheetHeader
        eyebrow="Inventory"
        description={`${filled}/${inventory.length} slots`}
        anchor="inventory-summary"
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <div
          data-drag-boundary-id={inventoryContainerNodeId}
          className="ak-game-width mx-auto grid gap-0 overflow-hidden border-l border-t border-slate-800"
          style={{ gridTemplateColumns: `repeat(${inventoryColumns}, minmax(0, 1fr))` }}
        >
          {inventory.map((slot) => (
            <InventoryCell
              key={slot.slotIndex}
              slot={slot}
              item={slot.stack ? game.items[slot.stack.itemId] : null}
              hidden={isSourceHidden(inventorySourceId(slot.slotIndex))}
              invalid={invalidInventorySlot === slot.slotIndex}
              onDoubleActivate={() => onSlotDoubleActivate(slot)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InventoryCell({
  slot,
  item,
  hidden,
  invalid,
  onDoubleActivate,
}: Readonly<{
  slot: InventorySlot;
  item: ViewItem | null;
  hidden: boolean;
  invalid: boolean;
  onDoubleActivate(): void;
}>) {
  const stack = slot.stack;
  const nodeId = inventorySlotNodeId(slot.slotIndex);
  const cellRef = useRef<HTMLDivElement | null>(null);
  useGsapCellFeedback(cellRef, { invalid, success: false });

  return (
    <DroppableSurface
      id={nodeId}
      nodeId={nodeId}
      payload={{ targetId: nodeId, targetNodeId: nodeId, target: { kind: "inventory-slot", slotIndex: slot.slotIndex } } satisfies GameDropData}
      nodeRef={(node) => { cellRef.current = node; }}
      data-inventory-slot={slot.slotIndex}
      className={(isOver) => cn(
        "relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
        isOver && "bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
        invalid && "ak-cell-error",
      )}
    >
      {stack && item ? <InventoryTile slot={slot} item={item} hidden={hidden} onDoubleActivate={onDoubleActivate} /> : null}
    </DroppableSurface>
  );
}

function InventoryTile({
  slot,
  item,
  hidden,
  onDoubleActivate,
}: Readonly<{
  slot: InventorySlot;
  item: ViewItem;
  hidden: boolean;
  onDoubleActivate(): void;
}>) {
  const stack = slot.stack;

  if (!stack) return null;

  const sourceId = inventorySourceId(slot.slotIndex);
  const sourceNodeId = inventorySlotNodeId(slot.slotIndex);

  return (
    <DraggableSurface
      id={`${sourceId}:drag`}
      nodeId={`${sourceId}:drag-node`}
      payload={{
        sourceId,
        sourceNodeId,
        itemId: stack.itemId,
        source: { kind: "inventory", slotIndex: slot.slotIndex, quantity: stack.quantity },
        overlay: { quantity: stack.quantity },
        hideWhenActive: stack.quantity <= 1,
      } satisfies GameDragData}
      hidden={hidden}
      className="absolute inset-0 touch-none"
      onDoubleActivate={onDoubleActivate}
    >
      <Tile item={item} quantity={stack.quantity} />
    </DraggableSurface>
  );
}
