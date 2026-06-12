import type { ReactNode } from "react";
import type { GameView, InventorySlot, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import {
  inventoryBinNodeId,
  inventorySlotNodeId,
  inventorySourceId,
  type GameDragData,
  type GameDropData,
} from "../types";
import { DraggableSurface, DroppableBottomSheet, DroppableSurface } from "./DragSurface";
import { Tile } from "./Tile";

export function InventorySheet({
  game,
  open,
  isSourceHidden,
  invalidInventorySlot,
  pulsedInventorySlot,
  onOpenChange,
  onSlotDoubleActivate,
}: Readonly<{
  game: GameView;
  open: boolean;
  isSourceHidden(sourceId: string): boolean;
  invalidInventorySlot: number | null;
  pulsedInventorySlot: number | null;
  onOpenChange(open: boolean): void;
  onSlotDoubleActivate(slot: InventorySlot): void;
}>) {
  const filled = game.inventory.filter((slot) => slot.stack).length;

  const header = (
    <div data-inventory-summary className="flex h-full items-center justify-between gap-3">
      <div>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-emerald-300">Inventory</p>
        <p className="text-sm text-slate-300">{filled}/{game.inventory.length} slots</p>
      </div>
      <button
        type="button"
        className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300"
        onClick={() => onOpenChange(!open)}
      >
        {open ? "Close" : "Open"}
      </button>
    </div>
  );

  return (
    <InventoryDropBin open={open} header={header} overClassName="outline outline-2 -outline-offset-2 outline-emerald-300/70" onOpenChange={onOpenChange} onClose={() => onOpenChange(false)}>
      <div className="max-h-[60vh] overflow-y-auto overscroll-contain pb-4">
        <div className="grid grid-cols-4 gap-0 overflow-hidden border-x border-slate-800">
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
    </InventoryDropBin>
  );
}

function InventoryDropBin({ children, open, header, overClassName, onOpenChange, onClose }: Readonly<{ children: ReactNode; open: boolean; header: ReactNode; overClassName: string; onOpenChange(open: boolean): void; onClose(): void }>) {
  return (
    <DroppableBottomSheet
      id={inventoryBinNodeId}
      nodeId={inventoryBinNodeId}
      payload={{ targetId: inventoryBinNodeId, targetNodeId: inventoryBinNodeId, target: { kind: "inventory-bin" } } satisfies GameDropData}
      open={open}
      header={header}
      peekHeight={80}
      className={(isOver) => cn("z-30", isOver && overClassName)}
      contentClassName="max-h-none overflow-visible"
      onOpenChange={onOpenChange}
      onClose={onClose}
    >
      {children}
    </DroppableBottomSheet>
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
        isOver && "z-10 bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
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
