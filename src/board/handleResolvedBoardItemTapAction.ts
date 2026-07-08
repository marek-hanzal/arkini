import { match } from "ts-pattern";
import type {
	BoardItemActivationRuntime,
	BoardItemActivationTarget,
} from "~/board/BoardItemActivationTypes";
import { handleActivationBoardItemTapAction } from "~/board/handleActivationBoardItemTapAction";
import {
	handleBoardMemoryTapAction,
	handleCheatSpeedTapAction,
	handleClaimCraftTapAction,
	handleStartCraftTapAction,
} from "~/board/handleBoardItemTapRuntimeAction";
import { resolveBoardItemTapAction } from "~/board/control/resolveBoardItemTapAction";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export const handleResolvedBoardItemTapAction = ({
	feedback,
	onOpenSheet,
	runtimeStore,
	target,
}: BoardItemActivationRuntime & {
	onOpenSheet(sheet: ActiveSheetState): void;
	target: BoardItemActivationTarget;
}) => {
	const action = resolveBoardItemTapAction({
		boardItem: target.liveBoardItem,
		nowMs: target.nowMs,
	});

	match(action)
		.with(
			{
				type: "claim-craft",
			},
			() =>
				handleClaimCraftTapAction({
					feedback,
					nowMs: target.nowMs,
					runtimeStore,
				}),
		)
		.with(
			{
				type: "start-craft",
			},
			({ boardItemId, recipeId }) =>
				handleStartCraftTapAction({
					boardItemId,
					feedback,
					nowMs: target.nowMs,
					recipeId,
					runtimeStore,
				}),
		)
		.with(
			{
				type: "open-sheet",
			},
			({ sheet }) => onOpenSheet(sheet),
		)
		.with(
			{
				type: "activate-board-memory",
			},
			({ boardItemId }) =>
				handleBoardMemoryTapAction({
					boardItemId,
					feedback,
					nowMs: target.nowMs,
					runtimeStore,
				}),
		)
		.with(
			{
				type: "set-cheat-speed-mode",
			},
			({ mode }) =>
				handleCheatSpeedTapAction({
					feedback,
					mode,
					nowMs: target.nowMs,
					runtimeStore,
				}),
		)
		.with(
			{
				type: "activate",
			},
			({ lineId }) =>
				handleActivationBoardItemTapAction({
					feedback,
					lineId,
					runtimeStore,
					target,
				}),
		)
		.exhaustive();
};
