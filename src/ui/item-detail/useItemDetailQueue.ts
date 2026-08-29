import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { projectItemDetailQueueFx } from "~/ui/item-detail/projectItemDetailQueueFx";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace useItemDetailQueue {
	export type Projection = projectItemDetailQueueFx.Result;
}

/** Projects the authoritative FIFO queue for one exact Item Detail target. */
export const useItemDetailQueue = (itemId: IdSchema.Type): useItemDetailQueue.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailQueue.Projection =>
			game.readOrThrow(
				projectItemDetailQueueFx({
					game,
					itemId,
					runtime,
				}),
			),
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(game, selector, Equal.equals);
};
