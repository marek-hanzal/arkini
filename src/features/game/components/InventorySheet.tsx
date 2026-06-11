import type { ReactNode } from "react";
import type { GameView, InventorySlot, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { usePressActions } from "../usePressActions";
import type { CommittedDrag, DragData, DropData } from "../types";
import { DraggableTileShell, DroppableBottomSheet, DroppableCell } from "./DragSurface";
import { Tile } from "./Tile";

export function InventorySheet({
  game,
  open,
  hiddenInventorySlots,
  committedDrag,
  activeDrag,
  invalidInventorySlot,
  pulsedInventorySlot,
  onOpenChange,
  onSlotDoubleActivate,
}: Readonly<{
  game: GameView;
  open: boolean;
  hiddenInventorySlots: ReadonlySet<number>;
  committedDrag: CommittedDrag | null;
  activeDrag: DragData | null;
  invalidInventorySlot: number | null;
  pulsedInventorySlot: number | null;
  onOpenChange(open: boolean): void;
  onSlotDoubleActivate(slot: InventorySlot): void;
}>) {
  const filled = game.inventory.filter((slot) => slot.stack).length;

  return (
    <InventoryDropBin open={open} overClassName="ring-2 ring-emerald-300/70" onClose={() => onOpenChange(false)}>
      <div data-inventory-summary className="border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
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
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-3 pb-4 pt-3">
        <div className="grid grid-cols-4 gap-1.5">
          {game.inventory.map((slot) => (
            <InventoryCell
              key={slot.slotIndex}
              slot={slot}
              item={slot.stack ? game.items[slot.stack.itemId] : null}
              hidden={
                hiddenInventorySlots.has(slot.slotIndex)
                || (activeDrag?.kind === "inventory" && activeDrag.slotIndex === slot.slotIndex && (slot.stack?.quantity ?? 0) <= 1)
                || (committedDrag?.hideSource === true && committedDrag.source.kind === "inventory" && committedDrag.source.slotIndex === slot.slotIndex)
              }
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

function InventoryDropBin({ children, open, overClassName, onClose }: Readonly<{ children: ReactNode; open: boolean; overClassName: string; onClose(): void }>) {
  return (
    <DroppableBottomSheet
      id="inventory-bin"
      data={{ kind: "inventory-bin" } satisfies DropData}
      open={open}
      keepMounted
      closedClassName="translate-y-[calc(100%-5rem)]"
      backdropClassName="z-20 bg-slate-950/50"
      sheetClassName="z-30"
      className={(isOver) => cn(isOver && overClassName)}
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
  const press = usePressActions({ onDouble: onDoubleActivate });

  return (
    <DroppableCell
      id={`inventory:${slot.slotIndex}`}
      data={{ kind: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData}
      data-inventory-slot={slot.slotIndex}
      className={(isOver) => cn(
        "relative aspect-square rounded-sm border border-slate-800 bg-slate-900/70 transition-colors duration-200",
        isOver && "bg-slate-800 ring-1 ring-emerald-300/70",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        pulsed && !invalid && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
      )}
      onClick={press.onClick}
      onDoubleClick={press.onDoubleClick}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
    >
      {stack && item ? <InventoryTile slot={slot} item={item} hidden={hidden} onDoubleActivate={onDoubleActivate} /> : null}
    </DroppableCell>
  );
}

function InventoryTile({ slot, item, hidden, onDoubleActivate }: Readonly<{ slot: InventorySlot; item: ViewItem; hidden: boolean; onDoubleActivate(): void }>) {
  const stack = slot.stack;

  if (!stack) return null;

  return (
    <DraggableTileShell
      id={`inventory:${slot.slotIndex}:drag`}
      data={{ kind: "inventory", slotIndex: slot.slotIndex, itemId: stack.itemId, quantity: stack.quantity } satisfies DragData}
      hidden={hidden}
      className="absolute inset-0 touch-none"
      onDoubleActivate={onDoubleActivate}
    >
      <Tile item={item} quantity={stack.quantity} />
    </DraggableTileShell>
  );
}
