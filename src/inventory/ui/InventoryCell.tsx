import { memo, type FC, useCallback, useMemo, useRef } from "react";
import { useMotionCellFeedback } from "~/board/hook/useMotionCellFeedback";
import { DroppableSurface } from "~/drag/ui/DroppableSurface";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import type { InventorySlot } from "~/play/logic/playTypes";
import type { DropData } from "~/play/types";
import { cn } from "~/shared/cn";

export namespace InventoryCell {
	export interface Props {
		slot: InventorySlot;
		invalid: boolean;
	}
}

export const InventoryCell: FC<InventoryCell.Props> = memo(({ slot, invalid }) => {
	const nodeId = inventorySlotNodeId(slot.slotIndex);
	const cellRef = useRef<HTMLDivElement | null>(null);
	useMotionCellFeedback(cellRef, {
		invalid,
		imprint: false,
		success: false,
	});
	const payload = useMemo(
		() =>
			({
				targetId: nodeId,
				targetNodeId: nodeId,
				target: {
					kind: "inventory-slot" as const,
					slotIndex: slot.slotIndex,
				},
			}) satisfies DropData,
		[
			nodeId,
			slot.slotIndex,
		],
	);
	const setCellNode = useCallback((node: HTMLDivElement | null) => {
		cellRef.current = node;
	}, []);
	const className = useCallback(
		(isOver: boolean) =>
			cn(
				"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
				isOver && "bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
				invalid && "ak-cell-error",
			),
		[
			invalid,
		],
	);

	return (
		<DroppableSurface
			id={nodeId}
			nodeId={nodeId}
			payload={payload}
			nodeRef={setCellNode}
			data-inventory-slot={slot.slotIndex}
			className={className}
		>
			{null}
		</DroppableSurface>
	);
});
