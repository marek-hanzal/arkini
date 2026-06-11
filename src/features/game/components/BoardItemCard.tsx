import { useDraggable } from "@dnd-kit/core";
import { memo, type MouseEvent } from "react";
import { TileContent } from "./TileContent";
import { ProducerCooldown } from "./ProducerCooldown";
import type { BoardItem, DragData, ViewItem } from "./types";

export const BoardItemCard = memo(function BoardItemCard({
  item,
  boardItem,
  selected,
  pending,
  mergePulse,
  onSelect,
  onProduce,
  onStash,
}: Readonly<{
  item: ViewItem;
  boardItem: BoardItem;
  selected: boolean;
  pending: boolean;
  mergePulse: boolean;
  onSelect(): void;
  onProduce(): void;
  onStash(): void;
}>) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `board-item:${boardItem.id}`,
    data: { type: "board", boardItemId: boardItem.id } satisfies DragData,
    disabled: pending,
  });

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1) return;
    onSelect();
  }

  function handleDoubleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onSelect();

    if (item.canProduce) {
      onProduce();
      return;
    }

    onStash();
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={pending}
      data-board-item-id={boardItem.id}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={[
        "relative flex h-full w-full cursor-grab flex-col items-center justify-center gap-1 overflow-hidden rounded-sm text-center transition duration-200 active:cursor-grabbing disabled:cursor-not-allowed",
        item.canProduce ? "bg-amber-300/10 shadow-inner shadow-amber-950/30" : "",
        selected ? "bg-emerald-500/15 ring-1 ring-emerald-300" : "hover:bg-slate-800/70",
        mergePulse ? "scale-110 bg-emerald-500/20 ring-2 ring-emerald-200" : "scale-100",
        isDragging ? "opacity-0" : "opacity-100",
      ].join(" ")}
      {...listeners}
      {...attributes}
    >
      {item.canProduce ? <ProducerCooldown item={item} boardItem={boardItem} /> : null}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-1">
        <TileContent item={item} />
      </div>
    </button>
  );
});
