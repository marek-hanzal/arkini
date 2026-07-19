import { useCallback } from "react";

import { useGameCommand } from "~/bridge/game/useGameCommand";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";

export namespace useMoveBoardItem {
	export interface Props {
		readonly itemId: string;
		readonly revision: string;
		readonly space: number;
		readonly x: number;
		readonly y: number;
	}
}

/** Adapts the public atomic item move command to one Board destination. */
export const useMoveBoardItem = () => {
	const move = useGameCommand(moveItemFx);

	return useCallback(
		({ itemId, revision, space, x, y }: useMoveBoardItem.Props) =>
			move({
				itemId,
				location: {
					scope: "board",
					space,
					position: {
						x,
						y,
					},
				},
				revision,
			}),
		[
			move,
		],
	);
};
