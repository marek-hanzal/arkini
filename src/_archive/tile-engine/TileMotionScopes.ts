import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const tileMotionScope = (tileId: TileEngine.Id) => `tile:${tileId}`;
export const tilePresenceMotionScope = (tileId: TileEngine.Id) => `tile-presence:${tileId}`;
export const tileFeedbackMotionScope = (tileId: TileEngine.Id) => `tile-feedback:${tileId}`;
