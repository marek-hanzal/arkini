import type { QueryClient } from "@tanstack/react-query";
import type { swapFx } from "~/board/fx/swapFx";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { patchBoardView } from "~/v0/mutation/optimistic/patchBoardView";

export namespace applyBoardSwapOptimisticPatch {
	export interface Props {
		queryClient: QueryClient;
		input: swapFx.Props;
	}
}

export const applyBoardSwapOptimisticPatch = ({
	queryClient,
	input,
}: applyBoardSwapOptimisticPatch.Props): OptimisticSnapshot => ({
	board: patchBoardView({
		queryClient,
		patch: (board) => {
			const source = board.byId[input.sourceBoardItemId];
			const target = board.byId[input.targetBoardItemId];
			if (!source || !target) return board;

			return rebuildBoardView(
				board.items.map((item) => {
					if (item.id === source.id) {
						return {
							...item,
							x: target.x,
							y: target.y,
						};
					}
					if (item.id === target.id) {
						return {
							...item,
							x: source.x,
							y: source.y,
						};
					}
					return item;
				}),
			);
		},
	}),
});
