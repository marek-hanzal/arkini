import type { InventorySlot, GameView, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import {
  inventoryBinNodeId,
  inventorySlotNodeId,
  inventorySourceId,
  type GameDragData,
  type GameDropData,
} from "../types";
import { DraggableSurface, DroppableSurface } from "./DragSurface";
import { SheetHeader } from "./SheetHeader";
import { Tile } from "./Tile";

export function InventorySheet({
  game,
  isSourceHidden,
  invalidInventorySlot,
  pulsedInventorySlot,
  onClose,
  onSlotDoubleActivate,
}: Readonly<{
  game: GameView;
  isSourceHidden(sourceId: string): boolean;
  invalidInventorySlot: number | null;
  pulsedInventorySlot: number | null;
  onClose(): void;
  onSlotDoubleActivate(slot: InventorySlot): void;
}>) {
  const filled = game.inventory.filter((slot) => slot.stack).length;

  return (
    <DroppableSurface
      id={inventoryBinNodeId}
      nodeId={inventoryBinNodeId}
      payload={{ targetId: inventoryBinNodeId, targetNodeId: inventoryBinNodeId, target: { kind: "inventory-bin" } } satisfies GameDropData}
      className={(isOver) => cn("flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col", isOver && "outline outline-2 -outline-offset-2 outline-emerald-300/70")}
    >
      <SheetHeader
        eyebrow="Inventory"
        description={`${filled}/${game.inventory.length} slots`}
        anchor="inventory-summary"
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="grid grid-cols-4 gap-0 overflow-hidden border-l border-t border-slate-800">
          {game.inventory.map((slot) => (
            <InventoryCell
              key={slot.slotIndex}
              slot={slot}
              item={slot.stack ? game.items[slot.stack.itemId] : null}
              hidden={isSourceHidden(inventorySourceId(slot.slotIndex))}
              invalid={invalidInventorySlot === slot.slotIndex}
              pulsed={pulsedInventorySlot === slot.slotIndex}
              onDoubleActivate={() => onSlotDoubleActivate(slot)}
            />
          ))}
        </div>
      </div>
    </DroppableSurface>
  );
}

function InventoryCell({
  slot,
  item,
  hidden,
  invalid,
  pulsed,
  onDoubleActivate,
}: Readonly<{
  slot: InventorySlot;
  item: ViewItem | null;
  hidden: boolean;
  invalid: boolean;
  pulsed: boolean;
  onDoubleActivate(): void;
}>) {
  const stack = slot.stack;
  const nodeId = inventorySlotNodeId(slot.slotIndex);

  return (
    <DroppableSurface
      id={nodeId}
      nodeId={nodeId}
      payload={{ targetId: nodeId, targetNodeId: nodeId, target: { kind: "inventory-slot", slotIndex: slot.slotIndex } } satisfies GameDropData}
      data-inventory-slot={slot.slotIndex}
      className={(isOver) => cn(
        "relative aspect-square border-b border-r border-slate-800 bg-slate-900/70 transition-colors duration-200",
        isOver && "bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        pulsed && !invalid && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
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
