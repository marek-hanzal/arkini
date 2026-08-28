import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
export namespace stopPixiTileActorActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
	}
}
export const stopPixiTileActorActivityParticlesFx = Effect.fnUntraced(function* (
	props: stopPixiTileActorActivityParticlesFx.Props,
) {
	return yield* runPixiTileActorActivityParticlesFx({
		...props,
		kind: "stop",
	});
});
