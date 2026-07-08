import { match } from "ts-pattern";
import type {
	BoardItemActivationRuntime,
	BoardItemActivationTarget,
} from "~/board/BoardItemActivationTypes";
import { dispatchBoardItemActivationRuntimeAction } from "~/board/dispatchBoardItemActivationRuntimeAction";
import { registerProducerMissingResourceHints } from "~/board/registerProducerMissingResourceHints";

const activateStashFromBoardTap = ({
	feedback,
	runtimeStore,
	target,
}: BoardItemActivationRuntime & {
	target: BoardItemActivationTarget;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			inputRefs: [],
			stashItemInstanceId: target.liveBoardItem.id,
			type: "stash.open",
		},
		feedback,
		nowMs: target.nowMs,
		runtimeStore,
	});
};

const activateProducerLineFromBoardTap = ({
	feedback,
	lineId,
	runtimeStore,
	target,
}: BoardItemActivationRuntime & {
	lineId?: string;
	target: BoardItemActivationTarget;
}) => {
	if (!lineId) return;
	registerProducerMissingResourceHints({
		board: target.liveBoard,
		lineId,
		nowMs: target.nowMs,
		producerItem: target.liveBoardItem,
	});
	dispatchBoardItemActivationRuntimeAction({
		action: {
			inputRefs: [],
			itemInstanceId: target.liveBoardItem.id,
			lineId,
			type: "line.start",
		},
		feedback,
		nowMs: target.nowMs,
		runtimeStore,
	});
};

export const handleActivationBoardItemTapAction = ({
	feedback,
	lineId,
	runtimeStore,
	target,
}: BoardItemActivationRuntime & {
	lineId?: string;
	target: BoardItemActivationTarget;
}) => {
	const activation = target.liveBoardItem.activation;
	if (!activation) return;

	match(activation.kind)
		.with("stash", () =>
			activateStashFromBoardTap({
				feedback,
				runtimeStore,
				target,
			}),
		)
		.with("producer", () =>
			activateProducerLineFromBoardTap({
				feedback,
				lineId,
				runtimeStore,
				target,
			}),
		)
		.exhaustive();
};
