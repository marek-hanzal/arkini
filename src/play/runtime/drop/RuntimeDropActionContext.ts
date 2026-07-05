import type { GameAction } from "~/action/GameActionSchema";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameRuntimeState, GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers/readBoardView";

export type RuntimeDropActionContext = {
	board: BoardView;
	nowMs: number;
	snapshot: GameRuntimeState;
	store: GameRuntimeStore;
};

export const readRuntimeDropActionContext = ({
	store,
}: {
	store: GameRuntimeStore;
}): RuntimeDropActionContext => {
	const snapshot = store.getSnapshot();
	const nowMs = Date.now();
	return {
		board: readBoardView(snapshot, nowMs),
		nowMs,
		snapshot,
		store,
	};
};

export const dispatchRuntimeDropAction = ({
	action,
	context,
}: {
	action: GameAction;
	context: RuntimeDropActionContext;
}) =>
	context.store.dispatch({
		action,
		nowMs: context.nowMs,
	});
