import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";

/** Returns the lifecycle-opacity ownership key for one physical retained actor instance. */
export const readPixiActorAlphaAnimationKey = (actor: Pick<PixiTileActor, "instanceId">) =>
	`actor-alpha:${actor.instanceId}`;
