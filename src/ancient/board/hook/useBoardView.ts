import { useSuspenseQuery } from "@tanstack/react-query";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { loadPlayBackend } from "~/play/hook/loadPlayBackend";
import { playQueryKeys } from "~/play/hook/playQueryKeys";

export function useBoardView(): BoardView {
	return useSuspenseQuery({
		queryKey: playQueryKeys.board,
		async queryFn() {
			const db = await loadPlayBackend();
			return db.readBoardView();
		},
	}).data;
}
