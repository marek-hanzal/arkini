import { match } from "ts-pattern";

import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";

export const tileInventoryOverlayZIndex = 50;

const inventoryActorOffset = tileInventoryOverlayZIndex;
const travellingActorOffset = tileInventoryOverlayZIndex * 2;

/**
 * Keeps passive Board/Toolbar actors below Inventory, Inventory actors above its
 * panel, and travelling actors above every tile surface.
 */
export const readTileActorStackingZIndex = ({
	location,
	phase,
	localZIndex,
}: {
	readonly location: TileLocation;
	readonly phase: TileActorPhaseSchema.Type;
	readonly localZIndex: number;
}) =>
	localZIndex +
	match(phase)
		.with("dragging", "combining", "settling", "impact", "exiting", () => travellingActorOffset)
		.with("stable", "hovered", "targeted", () =>
			location.scope === LocationScopeEnumSchema.enum.Inventory ? inventoryActorOffset : 0,
		)
		.exhaustive();
