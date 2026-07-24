import { Effect } from "effect";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileSlot } from "~/ui/tile/TileSlot";

/** Maps one canonical grid location to its stable surface-local slot identity. */
export const tileSlotForLocationFx = Effect.fn("tileSlotForLocationFx")((location: TileLocation) =>
	Effect.succeed<TileSlot>({
		id: `${location.position.x}:${location.position.y}`,
		x: location.position.x,
		y: location.position.y,
	}),
);
