import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

/** Reads physical contact geometry for a live actor without feeding back child-local magnetism. */
export const readPixiLiveActorContactPose = ({
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
	const targetScaleX = actor.container.scale.x;
	const targetScaleY = actor.container.scale.y;
	const movingScaleX = (actor.size * targetScaleX) / Math.max(1, movingActor.size);
	const movingScaleY = (actor.size * targetScaleY) / Math.max(1, movingActor.size);
	return {
		scaleX: movingScaleX,
		scaleY: movingScaleY,
		x:
			actor.container.x -
			actor.container.pivot.x * targetScaleX +
			movingActor.container.pivot.x * movingScaleX,
		y:
			actor.container.y -
			actor.container.pivot.y * targetScaleY +
			movingActor.container.pivot.y * movingScaleY,
	};
};
