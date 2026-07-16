import { useEffect, useRef } from "react";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import { useGame } from "~/bridge/game/useGame";

/** Subscribes one React presentation coordinator to committed transient event batches. */
export const useGameEvents = (
	listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
) => {
	const game = useGame();
	const listenerRef = useRef(listener);
	listenerRef.current = listener;

	useEffect(
		() => game.subscribeEvents((batch) => listenerRef.current(batch)),
		[
			game,
		],
	);
};
