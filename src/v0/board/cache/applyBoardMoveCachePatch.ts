import type { QueryClient } from "@tanstack/react-query";
import type { moveBoardItemFx } from "~/v0/board/fx/moveBoardItemFx";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";

export namespace applyBoardMoveCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: moveBoardItemFx.Props;
	}
}

export const applyBoardMoveCachePatch = ({
	queryClient,
	input,
}: applyBoardMoveCachePatch.Props): CacheSnapshot.Type => ({
	board: patchBoardViewCache({
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
