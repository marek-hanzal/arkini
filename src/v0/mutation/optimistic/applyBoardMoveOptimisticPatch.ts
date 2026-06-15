import type { QueryClient } from "@tanstack/react-query";
import type { moveFx } from "~/board/fx/moveFx";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { patchBoardView } from "~/v0/mutation/optimistic/patchBoardView";

export namespace applyBoardMoveOptimisticPatch {
	export interface Props {
		queryClient: QueryClient;
		input: moveFx.Props;
	}
}

export const applyBoardMoveOptimisticPatch = ({
	queryClient,
	input,
}: applyBoardMoveOptimisticPatch.Props): OptimisticSnapshot => ({
	board: patchBoardView({
		queryClient,
		patch: (board) =>
			rebuildBoardView(
				board.items.map((item) =>
					item.id === input.boardItemId
						? {
								...item,
								x: input.x,
								y: input.y,
							}
						: item,
				),
			),
	}),
});
