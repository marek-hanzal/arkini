import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

/** Reads physical contact geometry for a live actor without feeding back child-local magnetism. */
export const readPixiLiveActorContactPose = ({
	actorId,
	actors,
	movingActorSize,
}: {
	readonly actorId: string;
	readonly actors: ReadonlyMap<string, PixiTileActor>;
	readonly movingActorSize: number;
}) => {
	const actor = actors.get(actorId);
	if (actor === undefined || actor.container.destroyed) return null;
	const scale = actor.container.scale.x;
	return {
		scale: (actor.size * scale) / Math.max(1, movingActorSize),
		x: actor.container.x - actor.container.pivot.x * scale,
		y: actor.container.y - actor.container.pivot.y * scale,
	};
};
