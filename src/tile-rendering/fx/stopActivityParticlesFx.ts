import { Effect } from "effect";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { runActivityParticlesFx } from "~/tile-rendering/fx/runActivityParticlesFx";
export namespace stopActivityParticlesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
	}
}
export const stopActivityParticlesFx = Effect.fnUntraced(function* (
	props: stopActivityParticlesFx.Props,
) {
	return yield* runActivityParticlesFx({
		...props,
		kind: "stop",
	});
});
