import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { resolveItemDetailTargetFn } from "~/engine/item-detail/fn/resolveItemDetailTargetFn";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";

/** Resolves one requested Item Detail target against the latest committed runtime. */
export const useResolveItemDetailTarget = () => {
	const game = useGameEngine();
	return useCallback(
		(props: Omit<resolveItemDetailTargetFn.Props, "runtime" | "sources">) => {
			const runtime = game.getSnapshot();
			const sources = game.readOrThrow(
				readItemDetailSourcesFx({
					target: {
						kind: "runtime",
						itemId: props.itemId,
					},
					runtime,
				}),
			);
			return resolveItemDetailTargetFn({
				...props,
				runtime,
				sources,
			});
		},
		[
			game,
		],
	);
};
