import { Effect } from "effect";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { runActivityParticlesFx } from "~/tile-rendering/fx/runActivityParticlesFx";
export namespace startActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly rampIn?: boolean;
	}
}
export const startActivityParticlesFx = Effect.fnUntraced(function* (
	props: startActivityParticlesFx.Props,
) {
	return yield* runActivityParticlesFx({
		...props,
		kind: "start",
	});
});
