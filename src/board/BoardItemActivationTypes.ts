import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { Feedback } from "~/play/feedback/Feedback";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

export type BoardItemActivationTarget = {
	liveBoard: BoardView;
	liveBoardItem: BoardViewItem;
	nowMs: number;
};

export type BoardItemActivationRuntime = {
	feedback: Feedback.Type;
	runtimeStore: GameRuntimeStore;
};
