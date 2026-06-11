import type { GameView } from "~/domains/database";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { MouseEvent } from "react";
import { cellClass, cellSize } from "./constants";
import type { DragData, DropData, InventorySlot } from "./types";
import { TileContent } from "./TileContent";

export function InventoryPanel({
  game,
  pending,
  invalidTargetId,
  committedDrag,
  previewSlotIndex,
  pulseSlotIndex,
  onPlaceStack,
}: Readonly<{
  game: GameView;
  pending: boolean;
  invalidTargetId: string | null;
  committedDrag: DragData | null;
  previewSlotIndex: number | null;
  pulseSlotIndex: number | null;
  onPlaceStack(slotIndex: number, itemId: string): void;
}>) {
  const columns = 3;

  return (
    <section className="w-fit max-w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-3 shadow-xl shadow-slate-950/30">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">Inventory</p>
          <h2 className="text-base font-semibold text-white">Stack storage</h2>
        </div>
        <p className="text-xs font-medium text-slate-500">{game.inventory.length} slots</p>
      </div>
      <div className="mt-3 grid w-fit gap-2" style={{ gridTemplateColumns: `repeat(${columns}, ${cellSize})` }}>
          {game.inventory.map((slot) => (
            <InventorySlotCell
              key={slot.slotIndex}
              game={game}
              slot={slot}
              pending={pending}
              invalidTargetId={invalidTargetId}
              committedDrag={committedDrag}
              preview={previewSlotIndex === slot.slotIndex}
              pulse={pulseSlotIndex === slot.slotIndex}
              onPlaceStack={onPlaceStack}
            />
          ))}
      </div>
    </section>
  );
}

function InventorySlotCell({
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
}

function InventoryItemCard({
  item,
  quantity,
  slotIndex,
  pending,
  onPlace,
}: Readonly<{
  item: GameView["items"][string];
  quantity: number;
  slotIndex: number;
  pending: boolean;
  onPlace(): void;
}>) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `inventory-item:${slotIndex}`,
    data: { type: "inventory", slotIndex } satisfies DragData,
    disabled: pending,
  });

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    onPlace();
  }

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={handleDoubleClick}
      className={[
        "flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 rounded-lg transition active:cursor-grabbing",
        isDragging ? "opacity-0" : "hover:bg-slate-800/70",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      <TileContent item={item} />
      <span className="absolute bottom-1 right-1.5 rounded-full bg-slate-900 px-1.5 text-[0.7rem] font-bold text-slate-100">
        {quantity}
      </span>
    </div>
  );
}
