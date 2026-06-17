import type { QueryClient } from "@tanstack/react-query";
import type { mergeBoardItemsFx } from "~/v0/board/fx/mergeBoardItemsFx";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { resolveOptimisticBoardMergeVisualEvent } from "~/v0/board/logic/resolveOptimisticBoardMergeVisualEvent";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";

export namespace applyBoardMergeCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: mergeBoardItemsFx.Props;
	}
}

export const applyBoardMergeCachePatch = ({
	queryClient,
	input,
}: applyBoardMergeCachePatch.Props): CacheSnapshot.Type => {
	const board = queryClient.getQueryData<BoardView>(boardQueryKeys.view);
	if (!board) return {};

	const event = resolveOptimisticBoardMergeVisualEvent({
		board,
		input,
	});
	if (!event) {
		return {
			board,
		};
	}

	applyVisualEvents({
		queryClient,
		events: [
			event,
		],
	});

	return {
		board,
		boardTransientMergeGroupIds: [
			event.animation?.groupId ??
				`merge:${input.sourceBoardItemId}:${input.targetBoardItemId}`,
		],
	};
};
