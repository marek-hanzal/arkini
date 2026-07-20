import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { resolveItemDetailTarget } from "~/engine/item-detail/read/resolveItemDetailTarget";

/** Resolves one requested Item Detail target against the latest committed runtime. */
export const useResolveItemDetailTarget = () => {
	const game = useGameEngine();
	return useCallback(
		(props: Omit<resolveItemDetailTarget.Props, "runtime">) =>
			resolveItemDetailTarget({
				...props,
				runtime: game.getSnapshot(),
			}),
		[
			game,
		],
	);
};
