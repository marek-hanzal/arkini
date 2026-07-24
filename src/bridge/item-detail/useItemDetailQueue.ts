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
	const isEqual = useCallback(
		(left: useItemDetailQueue.Projection, right: useItemDetailQueue.Projection) => {
			if (left.kind !== right.kind) return false;
			if (left.kind === "unavailable" || right.kind === "unavailable") return true;
			return (
				left.itemId === right.itemId &&
				left.capacity === right.capacity &&
				left.activeCount === right.activeCount &&
				left.request.length === right.request.length &&
				left.request.every(
					(request, index) =>
						right.request[index]?.requestId === request.requestId &&
						right.request[index]?.lineId === request.lineId &&
						right.request[index]?.title === request.title,
				)
			);
		},
		[],
	);
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
	return useRuntimeSelector(game, selector, isEqual);
};
