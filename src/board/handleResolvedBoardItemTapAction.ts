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

	switch (action.type) {
		case "claim-craft":
			return handleClaimCraftTapAction({
				feedback,
				nowMs: target.nowMs,
				runtimeStore,
			});
		case "start-craft":
			return handleStartCraftTapAction({
				boardItemId: action.boardItemId,
				feedback,
				nowMs: target.nowMs,
				recipeId: action.recipeId,
				runtimeStore,
			});
		case "open-sheet":
			return onOpenSheet(action.sheet);
		case "activate-board-memory":
			return handleBoardMemoryTapAction({
				boardItemId: action.boardItemId,
				feedback,
				nowMs: target.nowMs,
				runtimeStore,
			});
		case "set-cheat-speed-mode":
			return handleCheatSpeedTapAction({
				feedback,
				mode: action.mode,
				nowMs: target.nowMs,
				runtimeStore,
			});
		case "activate":
			return handleActivationBoardItemTapAction({
				feedback,
				lineId: action.lineId,
				runtimeStore,
				target,
			});
	}
};
