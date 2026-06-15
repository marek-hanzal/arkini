import type { QueryClient } from "@tanstack/react-query";
import type { mergeFx } from "~/board/fx/mergeFx";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { patchBoardView } from "~/v0/mutation/optimistic/patchBoardView";

export namespace applyBoardMergeOptimisticPatch {
	export interface Props {
		queryClient: QueryClient;
		input: mergeFx.Props;
	}
}

export const applyBoardMergeOptimisticPatch = ({
	queryClient,
	input,
}: applyBoardMergeOptimisticPatch.Props): OptimisticSnapshot => ({
	board: patchBoardView({
		queryClient,
		patch: (board) =>
			rebuildBoardView(board.items.filter((item) => item.id !== input.sourceBoardItemId)),
	}),
});
