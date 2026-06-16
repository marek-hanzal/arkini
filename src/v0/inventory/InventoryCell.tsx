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
		data-ak-inventory-slot={slotIndex}
		className={cn(
			"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
			invalid && "ak-cell-error",
		)}
	/>
));
