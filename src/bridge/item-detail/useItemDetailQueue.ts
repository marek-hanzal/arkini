import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { projectItemDetailQueueFx } from "~/bridge/item-detail/projectItemDetailQueueFx";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailQueue {
	export type Projection = projectItemDetailQueueFx.Result;
}

/** Projects the authoritative FIFO queue for one exact Item Detail target. */
export const useItemDetailQueue = (itemId: IdSchema.Type): useItemDetailQueue.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailQueue.Projection => {
			const queue = game.readOrThrow(
				projectItemDetailQueueFx({
					game,
					itemId,
					runtime,
				}),
			);
			if (queue.kind === "unavailable") {
				return {
					kind: "unavailable",
				};
			}
			return {
				kind: "available",
				itemId: queue.itemId,
				capacity: queue.capacity,
				active: queue.active,
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
