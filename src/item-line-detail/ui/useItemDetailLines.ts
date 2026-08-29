import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import type { ItemDetailLines } from "~/item-line-detail/ui/ItemDetailLines";
import { projectItemDetailLinesFx } from "~/item-line-detail/ui/projectItemDetailLinesFx";
import { useRuntimeSelector } from "~/ui/game/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Projects the current visible product lines and authoritative action readiness of one exact line owner. */
export const useItemDetailLines = (itemId: IdSchema.Type): ItemDetailLines.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type) =>
			game.readOrThrow(
				projectItemDetailLinesFx({
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
