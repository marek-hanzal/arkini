import { memo } from "react";
import { cn } from "~/v0/ui/cn";

export namespace InventoryCell {
	export interface Props {
		slotIndex: number;
		invalid: boolean;
	}
}

export const InventoryCell = memo(({ slotIndex, invalid }: InventoryCell.Props) => (
	<div
		data-ui="inventory slot"
		data-ak-inventory-slot={slotIndex}
		className={cn(
			"relative aspect-square border-b border-r border-pink-200/70 bg-white/64",
			invalid && "ak-cell-error",
		)}
	/>
));
