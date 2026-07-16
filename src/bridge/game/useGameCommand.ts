import type { Effect } from "effect";
import { useCallback } from "react";

import type { GameSessionServices } from "~/bridge/game/GameSession";
import { useGame } from "~/bridge/game/useGame";

/** Adapts one public Effect command into a stable React callback. */
export const useGameCommand = <Props, Result, Error, Requirements extends GameSessionServices>(
	command: (props: Props) => Effect.Effect<Result, Error, Requirements>,
) => {
	const game = useGame();
	return useCallback(
		(props: Props) => game.run(command(props)),
		[
			command,
			game,
		],
	);
};
