import { type FC, useRef } from "react";
import { useGsapCellFeedback } from "~/board/hook/useGsapCellFeedback";
import { DroppableSurface } from "~/drag/ui/DragSurface";
import { inventorySlotNodeId } from "~/inventory/inventoryIdentity";
import { InventoryTile } from "~/inventory/ui/InventoryTile";
import type { InventorySlot, ViewItem } from "~/play/logic/playTypes";
import type { GameDropData } from "~/play/types";
import { cn } from "~/shared/cn";

export namespace InventoryCell {
	export interface Props {
		slot: InventorySlot;
		item?: ViewItem;
		hidden: boolean;
		invalid: boolean;
		onDoubleActivate(): void;
	}
}

export const InventoryCell: FC<InventoryCell.Props> = ({
	slot,
	item,
	hidden,
	invalid,
	onDoubleActivate,
}) => {
	const stack = slot.stack;
	const nodeId = inventorySlotNodeId(slot.slotIndex);
	const cellRef = useRef<HTMLDivElement | null>(null);
	useGsapCellFeedback(cellRef, {
		invalid,
		imprint: false,
		success: false,
	});

	return (
		<DroppableSurface
			id={nodeId}
			nodeId={nodeId}
			payload={
				{
					targetId: nodeId,
					targetNodeId: nodeId,
					target: {
						kind: "inventory-slot",
						slotIndex: slot.slotIndex,
					},
				} satisfies GameDropData
			}
			nodeRef={(node) => {
				cellRef.current = node;
			}}
			data-inventory-slot={slot.slotIndex}
			className={(isOver) =>
				cn(
					"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
					isOver &&
						"bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
					invalid && "ak-cell-error",
				)
			}
		>
			{stack && item ? (
				<InventoryTile
					slot={slot}
					item={item}
					hidden={hidden}
					onDoubleActivate={onDoubleActivate}
				/>
			) : null}
		</DroppableSurface>
	);
};
