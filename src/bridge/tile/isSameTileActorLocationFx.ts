import { Effect } from "effect";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";

/** Compares the complete physical identity of two renderer-visible grid locations. */
export const isSameTileActorLocationFx = Effect.fnUntraced(function* (
	left: TileActorItem["location"],
	right: TileActorItem["location"],
) {
	return (
		left.scope === right.scope &&
		left.position.x === right.position.x &&
		left.position.y === right.position.y &&
		(left.scope !== "board" || (right.scope === "board" && left.space === right.space))
	);
});
