import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";

/** Compares the complete physical identity of two renderer-visible grid locations. */
export const isSameTileActorLocationFn = (
	left: TileActorItem["location"],
	right: TileActorItem["location"],
) =>
	left.scope === right.scope &&
	left.position.x === right.position.x &&
	left.position.y === right.position.y &&
	(left.scope !== "board" || (right.scope === "board" && left.space === right.space));
