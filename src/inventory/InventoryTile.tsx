import { memo } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import { useGameItemView } from "~/play/runtime";
import type { ItemId } from "~/config/GameIdSchema";

export namespace InventoryTile {
	export interface Props {
		stackId: string;
		itemId: ItemId;
		quantity: number;
	}
}

export const InventoryTile = memo(({ stackId, itemId, quantity }: InventoryTile.Props) => {
	const item = useGameItemView(itemId);

	if (!item) return null;

	return (
		<div
			data-ui="inventory item"
			data-ak-inventory-stack-id={stackId}
			className="h-full w-full"
		>
			<GameItemView
				item={item}
				variant="inventory"
				quantity={quantity}
			/>
		</div>
	);
});
