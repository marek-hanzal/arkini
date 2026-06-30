import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { readRuntimeBoardItemViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

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
