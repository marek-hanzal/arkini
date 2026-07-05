import { resolveBoardDropFeedback } from "~/board/drop/resolveBoardDropFeedback";
import type { BoardTileEngineDragConfig } from "~/board/BoardTileEngineModelTypes";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";

export const readBoardDropFeedbackForRuntimeSnapshot = ({
	context,
	runtimeStore,
}: {
	context: Parameters<NonNullable<BoardTileEngineDragConfig["dropFeedback"]>>[0];
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) => {
	const snapshot = runtimeStore.getSnapshot();
	const nowMs = Date.now();

	return resolveBoardDropFeedback({
		board: readBoardView(snapshot, nowMs),
		config: snapshot.runtime.config,
		context,
		inventory: readInventoryView(snapshot),
	});
};
