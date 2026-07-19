import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";

/** Exact canonical and presentation origin facts captured when one gesture starts. */
export interface TileDragSource extends TileIdentity {
	readonly location: TileLocation;
	readonly surface: TileSurface;
	readonly slot: TileSlot;
}
