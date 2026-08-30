import { Effect } from "effect";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { ActorAnimator } from "~/tile-rendering/service/ActorAnimator";
import { runActorLifecycleFx } from "~/tile-rendering/fx/runActorLifecycleFx";
export namespace restoreActorExitFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly animator: ActorAnimator;
		readonly durationMs?: number;
	}
}
export const restoreActorExitFx = Effect.fnUntraced(function* (props: restoreActorExitFx.Props) {
	return yield* runActorLifecycleFx({
		...props,
		kind: "restore-exit",
	});
});
