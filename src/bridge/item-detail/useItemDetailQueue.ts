import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailQueueFx } from "~/engine/item-detail/read/readItemDetailQueueFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailQueue {
	export type Projection = readItemDetailQueueFx.Result;
}

/** Projects the authoritative FIFO queue for one exact Item Detail target. */
export const useItemDetailQueue = (itemId: IdSchema.Type): useItemDetailQueue.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailQueue.Projection => {
			const queue = game.readOrThrow(
				readItemDetailQueueFx({
					itemId,
					runtime,
				}),
			);
			if (!("itemId" in queue)) {
				return {
					kind: "unavailable",
				};
			}
			return {
				kind: "available",
				itemId: queue.itemId,
				capacity: queue.capacity,
				activeCount: queue.activeCount,
				request: queue.request,
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};
