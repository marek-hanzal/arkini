import { InventoryTile } from "~/v0/inventory/InventoryTile";
import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const renderInventoryTile = ({
	tile,
}: TileEngine.RenderTileProps<InventorySurface.TileData>) => (
	<InventoryTile slotIndex={tile.data.slotIndex} />
);
