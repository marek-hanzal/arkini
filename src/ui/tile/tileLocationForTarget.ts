import { match } from "ts-pattern";

import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";

/** Converts one concrete supported slot target into the engine grid-location grammar. */
export const tileLocationForTarget = (target: TileDropTarget): TileLocation | null => {
	if (target.kind !== "slot") return null;
	return match(target.surface)
		.with(
			{
				kind: "board",
			},
			(surface): TileLocation => ({
				scope: LocationScopeEnumSchema.enum.Board,
				space: surface.space,
				position: {
					x: target.slot.x,
					y: target.slot.y,
				},
			}),
		)
		.with(
			{
				kind: "inventory",
			},
			(): TileLocation => ({
				scope: LocationScopeEnumSchema.enum.Inventory,
				position: {
					x: target.slot.x,
					y: target.slot.y,
				},
			}),
		)
		.with(
			{
				kind: "toolbar",
			},
			(): TileLocation => ({
				scope: LocationScopeEnumSchema.enum.Toolbar,
				position: {
					x: target.slot.x,
					y: target.slot.y,
				},
			}),
		)
		.exhaustive();
};
