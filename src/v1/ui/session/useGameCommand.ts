import type { Effect } from "effect";
import { useCallback } from "react";

import type { GameSessionServices } from "~/v1/ui/session/GameSession";
import { useGameSession } from "~/v1/ui/session/GameSessionContext";

/** Adapts one public Effect command into a stable React callback. */
export const useGameCommand = <Props, Result, Error, Requirements extends GameSessionServices>(
	command: (props: Props) => Effect.Effect<Result, Error, Requirements>,
) => {
	const session = useGameSession();
	return useCallback(
		(props: Props) => session.run(command(props)),
		[
			command,
			session,
		],
	);
};
