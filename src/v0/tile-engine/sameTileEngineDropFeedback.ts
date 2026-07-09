import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const sameTileEngineDropFeedback = (
	left: TileEngine.ActiveDropFeedback | null | undefined,
	right: TileEngine.ActiveDropFeedback | null | undefined,
) =>
	left?.dropId === right?.dropId &&
	left?.effect === right?.effect &&
	left?.variant === right?.variant &&
	left?.targetTileId === right?.targetTileId;
