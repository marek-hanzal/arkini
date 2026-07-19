import { useEffect, useRef } from "react";

import type { GameEventBatchSchema } from "~/engine/event/schema/GameEventBatchSchema";
import { useGameEngine } from "~/bridge/game/useGameEngine";

/** Subscribes one React presentation coordinator to committed transient event batches. */
export const useGameEvents = (
	listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
) => {
	const game = useGameEngine();
	const listenerRef = useRef(listener);
	listenerRef.current = listener;

	useEffect(
		() => game.subscribeEvents((batch) => listenerRef.current(batch)),
		[
			game,
		],
	);
};
