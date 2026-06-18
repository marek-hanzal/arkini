import { memo } from "react";

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
		className="relative aspect-square bg-ak-surface/70"
	/>
));
