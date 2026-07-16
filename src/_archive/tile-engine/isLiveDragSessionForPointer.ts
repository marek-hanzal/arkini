import type { TileEngineActor } from "~/tile-engine/TileEngineActor.types";

export const isLiveDragSessionForPointer = <TDrag>({
	pointerId,
	session,
}: {
	pointerId: number;
	session: TileEngineActor.DragSession<TDrag> | null;
}) => Boolean(session && session.pointerId === pointerId && !session.released);
