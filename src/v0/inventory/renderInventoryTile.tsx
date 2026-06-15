import { GameItemView } from "~/item/ui/GameItemView";
import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const renderInventoryTile = ({
	tile,
}: TileEngine.RenderTileProps<InventorySurface.TileData>) => {
	const stack = tile.data.slot.stack;
	if (!stack) return null;

	return (
		<div
			data-ak-inventory-stack-id={stack.id}
			className="h-full w-full"
		>
			<GameItemView
				item={tile.data.item}
				variant="inventory"
				quantity={stack.quantity}
			/>
		</div>
	);
};
