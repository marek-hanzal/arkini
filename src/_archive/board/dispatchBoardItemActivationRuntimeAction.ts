import type { Feedback } from "~/play/feedback/Feedback";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

export const dispatchBoardItemActivationRuntimeAction = ({
	action,
	feedback,
	nowMs,
	runtimeStore,
}: {
	action: Parameters<GameRuntimeStore["dispatch"]>[0]["action"];
	feedback: Feedback.Type;
	nowMs: number;
	runtimeStore: GameRuntimeStore;
}) => {
	void runtimeStore
		.dispatch({
			action,
			nowMs,
		})
		.catch(feedback.showError);
};

export const tickRuntimeForReadyCraft = ({
	feedback,
	nowMs,
	runtimeStore,
}: {
	feedback: Feedback.Type;
	nowMs: number;
	runtimeStore: GameRuntimeStore;
}) => {
	void runtimeStore
		.tick({
			nowMs,
		})
		.catch(feedback.showError);
};
