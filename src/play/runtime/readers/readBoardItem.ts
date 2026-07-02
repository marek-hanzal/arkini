import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { readRuntimeBoardItemViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardItemViewFromGameSave";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

export const readBoardItem = ({
	boardItemId,
	state,
}: {
	boardItemId: string;
	state: GameRuntimeState;
}): BoardViewItem | undefined =>
	readRuntimeBoardItemViewFromGameSave({
		boardItemId,
		config: state.runtime.config,
		nowMs: state.nowMs,
		save: state.runtime.save,
	});
