import { Effect } from "effect";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { runActorLifecycleFx } from "~/tile-rendering/fx/runActorLifecycleFx";
export namespace startActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly durationMs?: number;
		readonly onCancelFn?: () => void;
		readonly onCompleteFn?: () => void;
	}
}
export const startActorExitFx = Effect.fnUntraced(function* (props: startActorExitFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "start-exit",
	});
});
