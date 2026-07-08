import type { GameAction } from "~/action/GameActionSchema";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

export const dispatchRuntimeDropAction = ({
	action,
	nowMs,
	store,
}: {
	action: GameAction;
	nowMs: number;
	store: GameRuntimeStore;
}) =>
	store.dispatch({
		action,
		nowMs,
	});
