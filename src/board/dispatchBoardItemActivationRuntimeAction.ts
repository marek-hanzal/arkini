import type { BoardItemActivationContext } from "~/board/BoardItemActivationTypes";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";

export const dispatchBoardItemActivationRuntimeAction = ({
	action,
	context,
}: {
	action: Parameters<GameRuntimeStore["dispatch"]>[0]["action"];
	context: BoardItemActivationContext;
}) => {
	void context.runtimeStore
		.dispatch({
			action,
			nowMs: context.nowMs,
		})
		.catch(context.feedback.showError);
};

export const tickRuntimeForReadyCraft = ({ context }: { context: BoardItemActivationContext }) => {
	void context.runtimeStore
		.tick({
			nowMs: context.nowMs,
		})
		.catch(context.feedback.showError);
};
