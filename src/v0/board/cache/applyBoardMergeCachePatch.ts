import type { QueryClient } from "@tanstack/react-query";
import type { mergeBoardItemsFx } from "~/v0/board/fx/mergeBoardItemsFx";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { GameConfigServiceLive } from "~/v0/game/logic/GameConfigServiceLive";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";

export namespace applyBoardMergeCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: mergeBoardItemsFx.Props;
	}
}

const createOptimisticMergeEvent = ({
	board,
	input,
}: {
	board: BoardView;
	input: mergeBoardItemsFx.Props;
}): ActionVisualEventSchema.Type | null => {
	const source = board.byId[input.sourceBoardItemId];
	const target = board.byId[input.targetBoardItemId];
	if (!source || !target) return null;

	const mergeRule = GameConfigServiceLive.resolveMergeRule(source.itemId, target.itemId);
	if (!mergeRule) return null;

	return {
		type: "item.merged",
		animation: ActionVisualAnimation.merge({
			cause: "merge",
			groupId: `merge:${source.id}:${target.id}`,
		}),
		sourceItemInstanceId: source.id,
		sourceItemId: source.itemId,
		targetItemInstanceId: target.id,
		targetItemId: target.itemId,
		resultItemId: mergeRule.resultItemId,
		consumeSource: mergeRule.consumeSource !== false,
	};
};

export const applyBoardMergeCachePatch = ({
	queryClient,
	input,
}: applyBoardMergeCachePatch.Props): CacheSnapshot.Type => {
	const board = queryClient.getQueryData<BoardView>(boardQueryKeys.view);
	if (!board) return {};

	const event = createOptimisticMergeEvent({
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
