import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";

/** Converts one concrete supported slot target into the engine grid-location grammar. */
export const tileLocationForTarget = (target: TileDropTarget): TileLocation | null => {
	if (target.kind !== "slot") return null;
	if (target.surface.kind === "board") {
		return {
			scope: "board",
			space: target.surface.space,
			position: {
				x: target.slot.x,
				y: target.slot.y,
			},
		};
	}
	if (target.surface.kind === "inventory") {
		return {
			scope: "inventory",
			position: {
				x: target.slot.x,
				y: target.slot.y,
			},
		};
	}
	return null;
};
