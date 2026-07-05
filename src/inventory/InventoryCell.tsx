import { memo } from "react";
import { cn } from "~/ui/cn";

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
		data-ak-cell-invalid={invalid ? "true" : undefined}
		className={cn(
			"relative aspect-square bg-white/45 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.10)]",
			invalid && "bg-ak-danger/15 outline outline-1 -outline-offset-1 outline-ak-danger/35",
		)}
	/>
));
