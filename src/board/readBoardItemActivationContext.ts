import { readExpectedBoardViewItem } from "~/board/view/readExpectedBoardViewItem";
import type { BoardItemActivationTarget } from "~/board/BoardItemActivationTypes";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers/readBoardView";

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
	const liveBoard = readBoardView(snapshot, nowMs);
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
