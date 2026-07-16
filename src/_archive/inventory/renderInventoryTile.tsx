import { InventoryTile } from "~/inventory/InventoryTile";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const renderInventoryTile = ({
	tile,
}: TileEngine.RenderTileProps<InventorySurface.TileData>) => (
	<InventoryTile
		stackId={tile.data.stackId}
		itemId={tile.data.itemId}
		quantity={tile.data.quantity}
	/>
);
