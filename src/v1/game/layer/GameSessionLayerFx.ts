import { Layer } from "effect";

import { GameCoreLayerFx } from "~/v1/game/layer/GameCoreLayerFx";
import { GameLoopLayerFx } from "~/v1/game/layer/GameLoopLayerFx";

export namespace GameSessionLayerFx {
	export interface Props extends GameCoreLayerFx.Props, GameLoopLayerFx.Props {}
}

/** Combines one game core with its scoped production loop. */
export const GameSessionLayerFx = ({
	config,
	state,
	intervalMs,
	onTickError,
}: GameSessionLayerFx.Props) => {
	const core = GameCoreLayerFx({
		config,
		state,
	});
	const loop = GameLoopLayerFx({
		intervalMs,
		onTickError,
	}).pipe(Layer.provide(core));

	return Layer.merge(core, loop);
};
