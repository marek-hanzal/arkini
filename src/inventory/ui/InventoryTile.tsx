import type { FC } from "react";
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
		onDoubleActivate(): void;
	}
}

export const InventoryTile: FC<InventoryTile.Props> = ({
	slot,
	item,
	hidden,
	onDoubleActivate,
}) => {
	const stack = slot.stack;

	if (!stack) return null;

	const sourceId = inventorySourceId(slot.slotIndex);
	const sourceNodeId = inventorySlotNodeId(slot.slotIndex);

	return (
		<DraggableSurface
			id={`${sourceId}:drag`}
			nodeId={`${sourceId}:drag-node`}
			payload={
				{
					sourceId,
					sourceNodeId,
					itemId: stack.itemId,
					source: {
						kind: "inventory",
						slotIndex: slot.slotIndex,
						quantity: stack.quantity,
					},
					overlay: {
						quantity: stack.quantity,
					},
					hideWhenActive: stack.quantity <= 1,
				} satisfies DragData
			}
			hidden={hidden}
			className="absolute inset-0 touch-none"
			onDoubleActivate={onDoubleActivate}
		>
			<GameItemView
				item={item}
				variant="inventory"
				quantity={stack.quantity}
			/>
		</DraggableSurface>
	);
};
