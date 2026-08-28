import { Effect } from "effect";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { PixiActorAnimator } from "~/ui/pixi/animation/PixiActorAnimator";
import { runPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/runPixiTileActorActivityParticlesFx";
export namespace startPixiTileActorActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: PixiActorAnimator;
		readonly rampIn?: boolean;
	}
}
export const startPixiTileActorActivityParticlesFx = Effect.fnUntraced(function* (
	props: startPixiTileActorActivityParticlesFx.Props,
) {
	return yield* runPixiTileActorActivityParticlesFx({
		...props,
		kind: "start",
	});
});
