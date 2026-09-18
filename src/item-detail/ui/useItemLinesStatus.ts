import { Equal, Exit } from "effect";
import { useCallback, useEffect, useState } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemDetailQueueFx } from "~/item-detail-read/fx/readItemDetailQueueFx";
import { readItemLineStatusesFn } from "~/item-detail-read/fn/readItemLineStatusesFn";

/** Debounces presentation only; commands and admission always use current runtime truth. */
export const useItemLinesStatus = (ownerItemId?: IdSchema.Type) => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			if (ownerItemId === undefined) return [];
			const result = game.readFn(
				readItemDetailQueueFx({
					itemId: ownerItemId,
					runtime,
				}),
			);
			if (Exit.isFailure(result)) throw result.cause;
			return readItemLineStatusesFn(result.value);
		},
		[
			game,
			ownerItemId,
		],
	);
	const current = useRuntimeSelector(game, selectorFn, Equal.equals);
	const [settled, setSettledFn] = useState({
		ownerItemId,
		statuses: current,
	});
	useEffect(() => {
		const timeout = setTimeout(
			() =>
				setSettledFn({
					ownerItemId,
					statuses: current,
				}),
			200,
		);
		return () => clearTimeout(timeout);
	}, [
		ownerItemId,
		current,
	]);
	return settled.ownerItemId === ownerItemId ? settled.statuses : current;
};
