import type { TileActorItem } from "~/bridge/tile/TileActorItem";

/** Compares the complete physical identity of two renderer-visible grid locations. */
export const isSameTileActorLocation = (
	left: TileActorItem["location"],
	right: TileActorItem["location"],
) =>
	left.scope === right.scope &&
	left.position.x === right.position.x &&
	left.position.y === right.position.y &&
	(left.scope !== "board" || (right.scope === "board" && left.space === right.space));
