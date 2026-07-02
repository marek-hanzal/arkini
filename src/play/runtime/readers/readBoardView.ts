import type { BoardView } from "~/board/view/BoardViewSchema";
import { readRuntimeBoardViewFromGameSave } from "~/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";
import type { GameRuntimeState } from "~/play/runtime/GameRuntimeStore";

export const readBoardView = (state: GameRuntimeState, nowMs = state.nowMs): BoardView =>
	readRuntimeBoardViewFromGameSave({
		config: state.runtime.config,
		nowMs,
		save: state.runtime.save,
	});
