import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameView, InventorySlot, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { usePressActions } from "../usePressActions";
import type { DragData, DropData } from "../types";
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
  committedDrag: DragData | null;
  activeDrag: DragData | null;
  invalidInventorySlot: number | null;
  pulsedInventorySlot: number | null;
  onOpenChange(open: boolean): void;
  onSlotDoubleActivate(slot: InventorySlot): void;
}>) {
  const { setNodeRef, isOver } = useDroppable({ id: "inventory-bin", data: { kind: "inventory-bin" } satisfies DropData });
  const filled = game.inventory.filter((slot) => slot.stack).length;

  return (
    <>
      {open ? <button type="button" aria-label="Close inventory" className="fixed inset-0 z-20 bg-slate-950/50" onClick={() => onOpenChange(false)} /> : null}

      <aside
        ref={setNodeRef}
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        className={cn(
          "fixed inset-x-0 z-30 mx-auto w-[min(100vw-1.5rem,430px)] rounded-t-lg border border-slate-800 bg-slate-950/96 shadow-2xl shadow-black/60 transition-transform duration-200",
          open ? "translate-y-0" : "translate-y-[calc(100%-5rem)]",
          isOver && "ring-2 ring-emerald-300/70",
        )}
      >
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
                  || (committedDrag?.kind === "inventory" && committedDrag.slotIndex === slot.slotIndex && (slot.stack?.quantity ?? 0) <= 1)
                }
                invalid={invalidInventorySlot === slot.slotIndex}
                pulsed={pulsedInventorySlot === slot.slotIndex}
                onDoubleActivate={() => onSlotDoubleActivate(slot)}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
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
  const { setNodeRef, isOver } = useDroppable({ id: `inventory:${slot.slotIndex}`, data: { kind: "inventory-slot", slotIndex: slot.slotIndex } satisfies DropData });
  const stack = slot.stack;

  return (
    <div
      ref={setNodeRef}
      data-inventory-slot={slot.slotIndex}
      className={cn(
        "relative aspect-square rounded-sm border border-slate-800 bg-slate-900/70 transition-colors duration-200",
        isOver && "bg-slate-800 ring-1 ring-emerald-300/70",
        invalid && "ak-shake bg-red-950/40 ring-2 ring-inset ring-red-300/70",
        pulsed && !invalid && "ak-cell-pulse bg-sky-950/35 ring-2 ring-inset ring-sky-300/60",
      )}
    >
      {stack && item ? <InventoryTile slot={slot} item={item} hidden={hidden} onDoubleActivate={onDoubleActivate} /> : null}
    </div>
  );
}

function InventoryTile({ slot, item, hidden, onDoubleActivate }: Readonly<{ slot: InventorySlot; item: ViewItem; hidden: boolean; onDoubleActivate(): void }>) {
  const stack = slot.stack;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inventory:${slot.slotIndex}:drag`,
    disabled: !stack,
    data: stack ? { kind: "inventory", slotIndex: slot.slotIndex, itemId: stack.itemId, quantity: stack.quantity } satisfies DragData : undefined,
  });
  const press = usePressActions({ onDouble: onDoubleActivate });

  if (!stack) return null;

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerDown(event);
    listeners?.onPointerDown?.(event);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerMove(event);
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    press.onPointerUp(event);
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("absolute inset-0 touch-none", (hidden || isDragging) && "opacity-0")}
      onClick={press.onClick}
      onDoubleClick={press.onDoubleClick}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
    >
      <Tile item={item} quantity={stack.quantity} />
    </div>
  );
}
