import { memo, type FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";

export namespace InventoryTile {
	export interface Props {
		slot: InventorySlot;
		item: ViewItem;
	}
}

export const InventoryTile: FC<InventoryTile.Props> = memo(({ slot, item }) => {
	const stack = slot.stack;
	if (!stack) return null;

	return (
		<div
			data-inventory-slot-tile={slot.slotIndex}
			data-inventory-stack-id={stack.id}
			className="h-full w-full"
		>
			<GameItemView
				item={item}
				variant="inventory"
				quantity={stack.quantity}
			/>
		</div>
	);
});
