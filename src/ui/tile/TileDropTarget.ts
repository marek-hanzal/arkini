import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";

/** The topmost registered destination under one released pointer. */
export type TileDropTarget =
	| {
			readonly kind: "slot";
			readonly surface: TileSurface;
			readonly slot: TileSlot;
			readonly occupant: TileIdentity | null;
	  }
	| {
			readonly kind: "surface";
			readonly surface: TileSurface;
	  }
	| {
			readonly kind: "outside";
	  };
