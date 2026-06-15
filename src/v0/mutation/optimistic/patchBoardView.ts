import type { QueryClient } from "@tanstack/react-query";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

export namespace patchBoardView {
	export interface Props {
		queryClient: QueryClient;
		patch(board: BoardView): BoardView;
	}
}

export const patchBoardView = ({ queryClient, patch }: patchBoardView.Props) => {
	let previous: BoardView | undefined;

	queryClient.setQueryData<BoardView>(playQueryKeys.board, (board) => {
		if (!board) return board;
		previous = board;
		return patch(board);
	});

	return previous;
};
