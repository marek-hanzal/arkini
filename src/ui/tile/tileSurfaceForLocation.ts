import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileSurface } from "~/ui/tile/TileSurface";

/** Maps one canonical grid location to its presentation surface identity. */
export const tileSurfaceForLocation = (location: TileLocation): TileSurface => {
	if (location.scope === "board") {
		return {
			id: `board:${location.space}`,
			kind: "board",
			space: location.space,
		};
	}
	return {
		id: "inventory",
		kind: "inventory",
	};
};
