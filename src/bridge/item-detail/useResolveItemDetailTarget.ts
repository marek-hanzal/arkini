import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { resolveItemDetailTarget } from "~/engine/item-detail/read/resolveItemDetailTarget";

/** Resolves one requested Item Detail target against the latest committed runtime. */
export const useResolveItemDetailTarget = () => {
	const game = useGameEngine();
	return useCallback(
		(props: Omit<resolveItemDetailTarget.Props, "runtime" | "sources">) => {
			const runtime = game.getSnapshot();
			const sources = game.readOrThrow(
				readItemDetailSourcesFx({
					itemId: props.itemId,
					runtime,
				}),
			);
			return resolveItemDetailTarget({
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
