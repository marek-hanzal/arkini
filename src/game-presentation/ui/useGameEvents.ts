import { useEffect, useRef } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";

/** Subscribes one React presentation coordinator to committed transient event batches. */
export const useGameEvents = (
	listenerFn: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
) => {
	const game = useGameEngine();
	const listenerRef = useRef(listenerFn);
	listenerRef.current = listenerFn;

	useEffect(
		() => game.subscribeEventsFn((batch) => listenerRef.current(batch)),
		[
			game,
		],
	);
};
