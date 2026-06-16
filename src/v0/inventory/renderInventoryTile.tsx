import { InventoryTile } from "~/v0/inventory/InventoryTile";
import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export const renderInventoryTile = ({
	tile,
}: TileEngine.RenderTileProps<InventorySurface.TileData>) => (
	<InventoryTile
		stackId={tile.data.stackId}
		itemId={tile.data.itemId}
		quantity={tile.data.quantity}
	/>
);
