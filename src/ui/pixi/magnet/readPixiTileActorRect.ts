import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

/** Reads an actor's live top-left AABB from its independent presentation transforms. */
export const readPixiTileActorRect = (actor: PixiTileActor) => {
	const scaleX = actor.container.scale.x;
	const scaleY = actor.container.scale.y;
	return {
		height: actor.height * scaleY,
		width: actor.width * scaleX,
		x: actor.container.x - actor.container.pivot.x * scaleX,
		y: actor.container.y - actor.container.pivot.y * scaleY,
	};
};
