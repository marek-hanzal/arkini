import { memo } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import { useGameRuntimeSelector } from "~/play/runtime/GameRuntimeContext";
import { useGameItemView } from "~/play/runtime/useGameRuntimeViews";
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
	const hasSavedMemory = useGameRuntimeSelector(
		(state) => Boolean(state.runtime.save.boardMemoryLayouts[stackId]),
		Object.is,
	);

	if (!item) return null;

	return (
		<div
			data-ui="inventory item"
			data-ak-inventory-stack-id={stackId}
			className="h-full w-full"
		>
			<GameItemView
				assetProgress={hasSavedMemory ? 1 : undefined}
				item={item}
				variant="inventory"
				quantity={quantity}
			/>
		</div>
	);
});
