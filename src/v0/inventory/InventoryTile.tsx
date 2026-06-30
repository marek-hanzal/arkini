import { memo } from "react";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import { useGameItemView } from "~/v0/play/runtime";
import type { ItemId } from "~/v0/game/config/GameIdSchema";

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
