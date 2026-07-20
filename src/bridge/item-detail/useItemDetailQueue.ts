import { useCallback } from "react";

import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { TileItemId } from "~/bridge/tile/TileItemId";
import { readItemDetailQueue } from "~/engine/item-detail/read/readItemDetailQueue";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailQueue {
	export type Projection = readItemDetailQueue.Result;
}

const sameRequests = (
	left: readonly readItemDetailQueue.Request[],
	right: readonly readItemDetailQueue.Request[],
) =>
	left.length === right.length &&
	left.every(
		(request, index) =>
			right[index]?.requestId === request.requestId &&
			right[index]?.lineId === request.lineId &&
			right[index]?.title === request.title,
	);

const sameProjection = (
	left: useItemDetailQueue.Projection,
	right: useItemDetailQueue.Projection,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.capacity === right.capacity &&
		left.activeCount === right.activeCount &&
		sameRequests(left.request, right.request)
	);
};

/** Projects the authoritative FIFO queue for one exact Item Detail target. */
export const useItemDetailQueue = (itemId: TileItemId): useItemDetailQueue.Projection => {
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			readItemDetailQueue({
				itemId,
				runtime,
			}),
		[
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
