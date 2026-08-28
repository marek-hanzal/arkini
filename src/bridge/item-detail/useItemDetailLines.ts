import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { projectItemDetailLinesFx } from "~/bridge/item-detail/projectItemDetailLinesFx";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailLines {
	export type Input = ItemDetailLines.Input;
	export type OutputSet = ItemDetailLines.OutputSet;
	export type Line = ItemDetailLines.Line;
	export type Projection = ItemDetailLines.Projection;
}

/** Projects the current visible product lines and authoritative action readiness of one exact line owner. */
export const useItemDetailLines = (itemId: IdSchema.Type): useItemDetailLines.Projection => {
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
