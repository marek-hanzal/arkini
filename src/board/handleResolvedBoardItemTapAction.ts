import { match } from "ts-pattern";
import { handleActivationBoardItemTapAction } from "~/board/handleActivationBoardItemTapAction";
import {
	handleBoardMemoryTapAction,
	handleCheatSpeedTapAction,
	handleClaimCraftTapAction,
	handleStartCraftTapAction,
} from "~/board/handleBoardItemTapRuntimeAction";
import type { BoardItemActivationContext } from "~/board/BoardItemActivationTypes";
import { resolveBoardItemTapAction } from "~/board/control/resolveBoardItemTapAction";

export const handleResolvedBoardItemTapAction = ({
	context,
}: {
	context: BoardItemActivationContext;
}) => {
	const action = resolveBoardItemTapAction({
		boardItem: context.liveBoardItem,
		nowMs: context.nowMs,
	});

	match(action)
		.with(
			{
				type: "claim-craft",
			},
			() =>
				handleClaimCraftTapAction({
					context,
				}),
		)
		.with(
			{
				type: "start-craft",
			},
			({ boardItemId, recipeId }) =>
				handleStartCraftTapAction({
					boardItemId,
					context,
					recipeId,
				}),
		)
		.with(
			{
				type: "open-sheet",
			},
			({ sheet }) => context.onOpenSheet(sheet),
		)
		.with(
			{
				type: "activate-board-memory",
			},
			({ boardItemId }) =>
				handleBoardMemoryTapAction({
					boardItemId,
					context,
				}),
		)
		.with(
			{
				type: "set-cheat-speed-mode",
			},
			({ mode }) =>
				handleCheatSpeedTapAction({
					context,
					mode,
				}),
		)
		.with(
			{
				type: "activate",
			},
			({ lineId }) =>
				handleActivationBoardItemTapAction({
					context,
					lineId,
				}),
		)
		.exhaustive();
};
