import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";

export const readBoardView = (state: GameRuntimeState, nowMs = state.nowMs): BoardView =>
	readRuntimeBoardViewFromGameSave({
		config: state.runtime.config,
		nowMs,
		save: state.runtime.save,
	});
