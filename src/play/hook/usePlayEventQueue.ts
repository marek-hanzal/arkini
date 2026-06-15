import { useActorRef } from "@xstate/react";
import { useCallback } from "react";
import { playEventQueueMachine } from "~/play/logic/playEventQueueMachine";

/**
 * GPT:FIX
 *
 * Write docs, why it's here and what it's used for.
 */
export function usePlayEventQueue() {
	const queue = useActorRef(playEventQueueMachine);

	return useCallback(
		<T>(label: string, run: () => Promise<T> | T) =>
			new Promise<T>((resolve, reject) => {
				queue.send({
					type: "ENQUEUE",
					event: {
						label,
						run,
						resolve: resolve as (value: unknown) => void,
						reject,
					},
				});
			}),
		[
			queue,
		],
	);
}
