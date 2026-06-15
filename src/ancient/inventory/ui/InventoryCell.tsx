import { memo, type FC } from "react";
import { useInventoryCellController } from "~/inventory/hook/useInventoryCellController";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { cn } from "~/shared/cn";

export namespace InventoryCell {
	export interface Props {
		slot: InventorySlot;
		invalid: boolean;
		isOver: boolean;
	}
}

export const InventoryCell: FC<InventoryCell.Props> = memo(({ slot, invalid, isOver }) => {
	const cell = useInventoryCellController({
		invalid,
	});

	return (
		<div
			ref={cell.cellRef}
			data-inventory-slot={slot.slotIndex}
			className={cn(
				"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
				isOver && "bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
				invalid && "ak-cell-error",
			)}
		>
			{null}
		</div>
	);
});
