import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { resolveItemDetailTargetFx } from "~/engine/item-detail/read/resolveItemDetailTargetFx";

/** Resolves one requested Item Detail target against the latest committed runtime. */
export const useResolveItemDetailTarget = () => {
	const game = useGameEngine();
	return useCallback(
		(props: Omit<resolveItemDetailTargetFx.Props, "runtime" | "sources">) => {
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
			return game.readOrThrow(
				resolveItemDetailTargetFx({
					...props,
					runtime,
					sources,
				}),
			);
		},
		[
			game,
		],
	);
};
