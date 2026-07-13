import { useEffect, useRef } from "react";

import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import { useGameSession } from "~/v1/ui/session/GameSessionContext";

/** Subscribes one React presentation coordinator to committed transient event batches. */
export const useGameEvents = (
	listener: (batch: GameEventBatchSchema.Type) => void | PromiseLike<void>,
) => {
	const session = useGameSession();
	const listenerRef = useRef(listener);
	listenerRef.current = listener;

	useEffect(
		() => session.subscribeEvents((batch) => listenerRef.current(batch)),
		[
			session,
		],
	);
};
