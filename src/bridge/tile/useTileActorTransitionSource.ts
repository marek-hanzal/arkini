import { useMemo } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { readTileActorTransitionFx } from "~/bridge/tile/readTileActorTransitionFx";

export interface TileActorTransitionSource {
	readonly initial: readTileActorTransitionFx.Result;
	readonly subscribe: (
		listener: (transition: readTileActorTransitionFx.Result) => void | PromiseLike<void>,
	) => () => void;
}

/** Exposes one exact current tile transition plus its ordered committed tail. */
export const useTileActorTransitionSource = (): TileActorTransitionSource => {
	const game = useGameEngine();

	return useMemo(() => {
		const project = (transition: ReturnType<typeof game.getTransitionSnapshot>) =>
			game.readOrThrow(readTileActorTransitionFx({ game, transition }));

		return {
			initial: project(game.getTransitionSnapshot()),
			subscribe: (listener) =>
				game.subscribeTransitions((transition) => listener(project(transition))),
		};
	}, [game]);
};
