import type { QueryClient } from "@tanstack/react-query";
import type { swapBoardItemsFx } from "~/v0/board/fx/swapBoardItemsFx";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";

export namespace applyBoardSwapCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: swapBoardItemsFx.Props;
	}
}

export const applyBoardSwapCachePatch = ({
	queryClient,
	input,
}: applyBoardSwapCachePatch.Props): CacheSnapshot.Type => ({
	board: patchBoardViewCache({
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
