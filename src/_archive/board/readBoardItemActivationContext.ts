import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import type { BoardItemActivationTarget } from "~/board/BoardItemActivationTypes";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readRuntimeBoardView } from "~/play/runtime/readRuntimeViews";

export const readBoardItemActivationTarget = ({
	boardItemId,
	expectedItemId,
	runtimeStore,
}: {
	boardItemId: string;
	expectedItemId: string;
	runtimeStore: GameRuntimeStore;
}): BoardItemActivationTarget | undefined => {
	const snapshot = runtimeStore.getSnapshot();
	const nowMs = Date.now();
	const liveBoard = readRuntimeBoardView(snapshot, nowMs);
	const liveBoardItem = readExpectedBoardViewItem({
		board: liveBoard,
		expectedItemId,
		itemInstanceId: boardItemId,
	});
	if (!liveBoardItem) return undefined;

	return {
		liveBoard,
		liveBoardItem,
		nowMs,
	};
};
