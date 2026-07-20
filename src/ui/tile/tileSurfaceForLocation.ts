import { match } from "ts-pattern";

import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileSurface } from "~/ui/tile/TileSurface";

/** Maps one canonical grid location to its presentation surface identity. */
export const tileSurfaceForLocation = (location: TileLocation): TileSurface =>
	match(location)
		.with(
			{
				scope: "board",
			},
			(board): TileSurface => ({
				id: `board:${board.space}`,
				kind: "board",
				space: board.space,
			}),
		)
		.with(
			{
				scope: "inventory",
			},
			(): TileSurface => ({
				id: "inventory",
				kind: "inventory",
			}),
		)
		.with(
			{
				scope: "toolbar",
			},
			(): TileSurface => ({
				id: "toolbar",
				kind: "toolbar",
			}),
		)
		.exhaustive();
