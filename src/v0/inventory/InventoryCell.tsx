import { memo } from "react";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import { cn } from "~/v0/ui/cn";

export namespace InventoryCell {
	export interface Props {
		slot: InventorySlot;
		invalid: boolean;
		isOver: boolean;
	}
}

export const InventoryCell = memo(({ slot, invalid, isOver }: InventoryCell.Props) => (
	<div
		data-ak-inventory-slot={slot.slotIndex}
		className={cn(
			"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
			isOver && "bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
			invalid && "ak-cell-error",
		)}
	/>
));
