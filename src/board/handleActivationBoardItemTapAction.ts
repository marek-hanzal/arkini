import { match } from "ts-pattern";
import type { BoardItemActivationContext } from "~/board/BoardItemActivationTypes";
import { dispatchBoardItemActivationRuntimeAction } from "~/board/dispatchBoardItemActivationRuntimeAction";
import { registerProducerMissingResourceHints } from "~/board/registerProducerMissingResourceHints";

const activateStashFromBoardTap = ({ context }: { context: BoardItemActivationContext }) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			inputRefs: [],
			stashItemInstanceId: context.liveBoardItem.id,
			type: "stash.open",
		},
		context,
	});
};

const activateProducerLineFromBoardTap = ({
	context,
	lineId,
}: {
	context: BoardItemActivationContext;
	lineId?: string;
}) => {
	if (!lineId) return;
	registerProducerMissingResourceHints({
		context,
	});
	dispatchBoardItemActivationRuntimeAction({
		action: {
			inputRefs: [],
			itemInstanceId: context.liveBoardItem.id,
			lineId,
			type: "line.start",
		},
		context,
	});
};

export const handleActivationBoardItemTapAction = ({
	context,
	lineId,
}: {
	context: BoardItemActivationContext;
	lineId?: string;
}) => {
	const activation = context.liveBoardItem.activation;
	if (!activation) return;

	match(activation.kind)
		.with("stash", () =>
			activateStashFromBoardTap({
				context,
			}),
		)
		.with("producer", () =>
			activateProducerLineFromBoardTap({
				context,
				lineId,
			}),
		)
		.exhaustive();
};
