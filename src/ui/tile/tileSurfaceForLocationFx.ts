import { Effect } from "effect";
import { match } from "ts-pattern";

import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";

/** Maps one canonical grid location to its presentation surface identity. */
export const tileSurfaceForLocationFx = Effect.fn("tileSurfaceForLocationFx")(
	(location: TileLocation) =>
		Effect.sync(
			(): TileSurface =>
				match(location)
					.with(
						{
							scope: LocationScopeEnumSchema.enum.Board,
						},
						(board): TileSurface => ({
							id: `board:${board.space}`,
							kind: "board",
							space: board.space,
						}),
					)
					.with(
						{
							scope: LocationScopeEnumSchema.enum.Inventory,
						},
						(): TileSurface => ({
							id: "inventory",
							kind: "inventory",
						}),
					)
					.with(
						{
							scope: LocationScopeEnumSchema.enum.Toolbar,
						},
						(): TileSurface => ({
							id: "toolbar",
							kind: "toolbar",
						}),
					)
					.exhaustive(),
		),
);
