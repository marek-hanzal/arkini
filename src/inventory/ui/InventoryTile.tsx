import { memo, type FC, useCallback, useMemo } from "react";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { DraggableSurface } from "~/drag/ui/DraggableSurface";
import { GameItemView } from "~/item/ui/GameItemView";
import type { InventorySlot, ViewItem } from "~/play/logic/playTypes";
import type { DragData } from "~/play/types";

export namespace InventoryTile {
	export interface Props {
		slot: InventorySlot;
		item: ViewItem;
		hidden: boolean;
		onDoubleActivate(slot: InventorySlot): void;
	}
}

export const InventoryTile: FC<InventoryTile.Props> = memo(
	({ slot, item, hidden, onDoubleActivate }) => {
		const stack = slot.stack;

		if (!stack) return null;

		const sourceId = inventorySourceId(slot.slotIndex);
		const sourceNodeId = inventorySlotNodeId(slot.slotIndex);
		const payload = useMemo(
			() =>
				({
					sourceId,
					sourceNodeId,
					itemId: stack.itemId,
					source: {
						kind: "inventory" as const,
						slotIndex: slot.slotIndex,
						quantity: stack.quantity,
					},
					overlay: {
						quantity: stack.quantity,
					},
					hideWhenActive: stack.quantity <= 1,
				}) satisfies DragData,
			[
				slot.slotIndex,
				sourceId,
				sourceNodeId,
				stack.itemId,
				stack.quantity,
			],
		);
		const handleDoubleActivate = useCallback(
			() => onDoubleActivate(slot),
			[
				onDoubleActivate,
				slot,
			],
		);

		return (
			<DraggableSurface
				id={`${sourceId}:drag`}
				nodeId={`${sourceId}:drag-node`}
				payload={payload}
				data-inventory-slot-tile={slot.slotIndex}
				hidden={hidden}
				className="absolute inset-0 touch-none"
				onDoubleActivate={handleDoubleActivate}
			>
				<GameItemView
					item={item}
					variant="inventory"
					quantity={stack.quantity}
				/>
			</DraggableSurface>
		);
	},
);
