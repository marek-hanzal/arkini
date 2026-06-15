import type { TileEngineActor } from "~/v0/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export const dragSessionRect = <TDrag>(
	session: TileEngineActor.DragSession<TDrag>,
): TileEngine.Rect => ({
	...session.origin,
	left: session.origin.left + session.currentX,
	top: session.origin.top + session.currentY,
});
