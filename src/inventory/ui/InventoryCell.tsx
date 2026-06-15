import { memo, type FC, useRef } from "react";
import { useMotionCellFeedback } from "~/board/hook/useMotionCellFeedback";
import type { InventorySlot } from "~/play/logic/playTypes";
import { cn } from "~/shared/cn";

export namespace InventoryCell {
	export interface Props {
		slot: InventorySlot;
		invalid: boolean;
		isOver: boolean;
	}
}

export const InventoryCell: FC<InventoryCell.Props> = memo(({ slot, invalid, isOver }) => {
	const cellRef = useRef<HTMLDivElement | null>(null);
	useMotionCellFeedback(cellRef, {
		invalid,
		imprint: false,
		success: false,
	});

	return (
		<div
			ref={cellRef}
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
