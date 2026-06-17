import type { mergeBoardItemsFx } from "~/v0/board/fx/mergeBoardItemsFx";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { GameConfigServiceLive } from "~/v0/game/logic/GameConfigServiceLive";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export namespace resolveOptimisticBoardMergeVisualEvent {
	export interface Props {
		board: BoardView;
		input: mergeBoardItemsFx.Props;
	}
}

export const resolveOptimisticBoardMergeVisualEvent = ({
	board,
	input,
}: resolveOptimisticBoardMergeVisualEvent.Props): ActionVisualEventSchema.Type | null => {
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
