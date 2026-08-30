import { Effect } from "effect";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { runActorLifecycleFx } from "~/tile-rendering/fx/runActorLifecycleFx";
export namespace startActorEnterFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly delayMs?: number;
		readonly durationMs?: number;
	}
}
export const startActorEnterFx = Effect.fnUntraced(function* (props: startActorEnterFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "start-enter",
	});
});
