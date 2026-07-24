import { Effect } from "effect";
import { match } from "ts-pattern";

import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";

export const tileInventoryOverlayZIndex = 50;

const inventoryActorOffset = tileInventoryOverlayZIndex;
const draggingActorOffset = tileInventoryOverlayZIndex * 2;

/**
 * Keeps passive Board/Toolbar actors below Inventory, Inventory actors above its
 * panel, and the directly dragged actor above every tile surface.
 */
export const readTileActorStackingZIndexFx = Effect.fn("readTileActorStackingZIndexFx")(
	({
		location,
		phase,
		localZIndex,
	}: {
		readonly location: TileLocation;
		readonly phase: TileActorPhaseSchema.Type;
		readonly localZIndex: number;
	}) =>
		Effect.sync(
			() =>
				localZIndex +
				match(phase)
					.with("dragging", () => draggingActorOffset)
					.with("stable", "targeted", () =>
						location.scope === LocationScopeEnumSchema.enum.Inventory
							? inventoryActorOffset
							: 0,
					)
					.exhaustive(),
		),
);
