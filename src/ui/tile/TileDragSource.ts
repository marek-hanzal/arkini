import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";

/** Canonical presentation identity and origin facts captured when one drag starts. */
export interface TileDragSource extends TileIdentity {
	readonly surface: TileSurface;
	readonly slot: TileSlot;
}
