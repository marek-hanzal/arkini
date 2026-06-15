import type { QueryClient } from "@tanstack/react-query";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";

export namespace patchBoardViewCache {
	export interface Props {
		queryClient: QueryClient;
		patch(board: BoardView): BoardView;
	}
}

export const patchBoardViewCache = ({ queryClient, patch }: patchBoardViewCache.Props) => {
	let previous: BoardView | undefined;

	queryClient.setQueryData<BoardView>(boardQueryKeys.view, (board) => {
		if (!board) return board;
		previous = board;
		return patch(board);
	});

	return previous;
};
