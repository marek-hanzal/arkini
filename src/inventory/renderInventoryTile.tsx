import { InventoryTile } from "~/inventory/InventoryTile";
import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { TileEngineNamespace as TileEngine } from "~/tile-engine";

export const renderInventoryTile = ({
	tile,
}: TileEngine.RenderTileProps<InventorySurface.TileData>) => (
	<InventoryTile
		stackId={tile.data.stackId}
		itemId={tile.data.itemId}
		quantity={tile.data.quantity}
	/>
);
