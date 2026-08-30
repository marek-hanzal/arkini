import { Effect } from "effect";

import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";

/** Acquires a synchronous live-actor contact reader for animation-frame target projection. */
export const createLiveContactPoseReaderFx = Effect.fnUntraced(function* () {
	return ({
		actorId,
		actors,
		movingActor,
	}: {
		readonly actorId: string;
		readonly actors: ReadonlyMap<string, PixiTileActor>;
		readonly movingActor: PixiTileActor;
	}) => {
		const actor = actors.get(actorId);
		if (actor === undefined || actor.container.destroyed) return null;
		const targetScale = actor.container.scale.x;
		const movingScale = (actor.size * targetScale) / Math.max(1, movingActor.size);
		return {
			scale: movingScale,
			x:
				actor.container.x -
				actor.container.pivot.x * targetScale +
				movingActor.container.pivot.x * movingScale,
			y:
				actor.container.y -
				actor.container.pivot.y * targetScale +
				movingActor.container.pivot.y * movingScale,
		};
	};
});
