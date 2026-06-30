import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readBoardView = (state: GameRuntimeState): BoardView =>
	readRuntimeBoardViewFromGameSave({
		config: state.runtime.config,
		nowMs: state.nowMs,
		save: state.runtime.save,
	});
