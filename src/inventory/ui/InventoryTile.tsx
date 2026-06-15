import { memo, type FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { InventorySlot, ViewItem } from "~/play/logic/playTypes";

export namespace InventoryTile {
	export interface Props {
		slot: InventorySlot;
		item: ViewItem;
		onDoubleActivate(slot: InventorySlot): void;
	}
}

export const InventoryTile: FC<InventoryTile.Props> = memo(({ slot, item }) => {
	const stack = slot.stack;
	if (!stack) return null;

	return (
		<GameItemView
			item={item}
			variant="inventory"
			quantity={stack.quantity}
		/>
	);
});
