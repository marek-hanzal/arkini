import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import type { BoardItemActivationContext } from "~/board/BoardItemActivationTypes";
import type { Feedback } from "~/play/feedback/Feedback";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export const readBoardItemActivationContext = ({
	boardItemId,
	expectedItemId,
	feedback,
	onOpenSheet,
	runtimeStore,
}: {
	boardItemId: string;
	expectedItemId: string;
	feedback: Feedback.Type;
	onOpenSheet(sheet: ActiveSheetState): void;
	runtimeStore: GameRuntimeStore;
}): BoardItemActivationContext | undefined => {
	const snapshot = runtimeStore.getSnapshot();
	const nowMs = Date.now();
	const liveBoard = readBoardView(snapshot, nowMs);
	const liveBoardItem = readExpectedBoardViewItem({
		board: liveBoard,
		expectedItemId,
		itemInstanceId: boardItemId,
	});
	if (!liveBoardItem) return undefined;

	return {
		feedback,
		liveBoard,
		liveBoardItem,
		nowMs,
		onOpenSheet,
		runtimeStore,
	};
};
