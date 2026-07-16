import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export const dragSessionRect = <TDrag>(
	session: TileEngineActor.DragSession<TDrag>,
): TileEngine.Rect => ({
	...session.origin,
	left: session.origin.left + session.currentX,
	top: session.origin.top + session.currentY,
});
