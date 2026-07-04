import { useCallback } from "react";
import { match } from "ts-pattern";
import { resolveBoardItemTapAction } from "~/board/control/resolveBoardItemTapAction";
import { readProducerMissingResourceHintTileIds } from "~/producer/view/readProducerMissingResourceHintTileIds";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { Feedback } from "~/play/feedback/Feedback";
import { registerBoardTileBounceFeedback } from "~/play/game-engine-visual/registerBoardTileBounceFeedback";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

export namespace useBoardItemActivation {
	export interface Props {
		feedback: Feedback.Type;
		onOpenSheet(sheet: ActiveSheetState): void;
	}

	export type Result = (boardItemId: string, expectedItemId: string) => void;
}

type BoardItemActivationContext = {
	feedback: Feedback.Type;
	liveBoard: BoardView;
	liveBoardItem: BoardViewItem;
	nowMs: number;
	onOpenSheet(sheet: ActiveSheetState): void;
	runtimeStore: GameRuntimeStore;
};

const readBoardItemActivationContext = ({
	boardItemId,
	expectedItemId,
	feedback,
	onOpenSheet,
	runtimeStore,
}: {
	boardItemId: string;
	expectedItemId: string;
	feedback: Feedback.Type;
	onOpenSheet(sheet: ActiveSheetState): void;
	runtimeStore: GameRuntimeStore;
}): BoardItemActivationContext | undefined => {
	const snapshot = runtimeStore.getSnapshot();
	const nowMs = Date.now();
	const liveBoard = readBoardView(snapshot, nowMs);
	const liveBoardItem = liveBoard.byId[boardItemId];
	if (!liveBoardItem || liveBoardItem.itemId !== expectedItemId) return undefined;

	return {
		feedback,
		liveBoard,
		liveBoardItem,
		nowMs,
		onOpenSheet,
		runtimeStore,
	};
};

const dispatchBoardItemTapAction = ({
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

const tickRuntimeForReadyCraft = ({ context }: { context: BoardItemActivationContext }) => {
	void context.runtimeStore
		.tick({
			nowMs: context.nowMs,
		})
		.catch(context.feedback.showError);
};

const registerProducerMissingResourceHints = ({
	context,
}: {
	context: BoardItemActivationContext;
}) => {
	const hintTileIds = readProducerMissingResourceHintTileIds({
		board: context.liveBoard,
		producerItem: context.liveBoardItem,
	});
	if (hintTileIds.length === 0) return;

	registerBoardTileBounceFeedback({
		groupId: `producer-missing-resource-hint:${context.liveBoardItem.id}:${context.nowMs}`,
		tileIds: hintTileIds,
	});
};

const activateStashFromBoardTap = ({ context }: { context: BoardItemActivationContext }) => {
	dispatchBoardItemTapAction({
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
	dispatchBoardItemTapAction({
		action: {
			inputRefs: [],
			itemInstanceId: context.liveBoardItem.id,
			lineId,
			type: "line.start",
		},
		context,
	});
};

const handleActivationTapAction = ({
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

const handleClaimCraftTapAction = ({ context }: { context: BoardItemActivationContext }) => {
	tickRuntimeForReadyCraft({
		context,
	});
};

const handleStartCraftTapAction = ({
	boardItemId,
	context,
	recipeId,
}: {
	boardItemId: string;
	context: BoardItemActivationContext;
	recipeId: string;
}) => {
	dispatchBoardItemTapAction({
		action: {
			recipeId,
			targetItemInstanceId: boardItemId,
			type: "craft.start",
		},
		context,
	});
};

const handleBoardMemoryTapAction = ({
	boardItemId,
	context,
}: {
	boardItemId: string;
	context: BoardItemActivationContext;
}) => {
	dispatchBoardItemTapAction({
		action: {
			boardItemId,
			type: "board.memory.activate",
		},
		context,
	});
};

const handleCheatSpeedTapAction = ({
	context,
	mode,
}: {
	context: BoardItemActivationContext;
	mode: GameCheatSpeedMode;
}) => {
	dispatchBoardItemTapAction({
		action: {
			mode,
			type: "cheat.speed_mode.set",
		},
		context,
	});
};

const handleResolvedBoardItemTapAction = ({ context }: { context: BoardItemActivationContext }) => {
	const action = resolveBoardItemTapAction({
		boardItem: context.liveBoardItem,
		nowMs: context.nowMs,
	});

	match(action)
		.with(
			{
				type: "claim-craft",
			},
			() =>
				handleClaimCraftTapAction({
					context,
				}),
		)
		.with(
			{
				type: "start-craft",
			},
			({ boardItemId, recipeId }) =>
				handleStartCraftTapAction({
					boardItemId,
					context,
					recipeId,
				}),
		)
		.with(
			{
				type: "open-sheet",
			},
			({ sheet }) => context.onOpenSheet(sheet),
		)
		.with(
			{
				type: "activate-board-memory",
			},
			({ boardItemId }) =>
				handleBoardMemoryTapAction({
					boardItemId,
					context,
				}),
		)
		.with(
			{
				type: "set-cheat-speed-mode",
			},
			({ mode }) =>
				handleCheatSpeedTapAction({
					context,
					mode,
				}),
		)
		.with(
			{
				type: "activate",
			},
			({ lineId }) =>
				handleActivationTapAction({
					context,
					lineId,
				}),
		)
		.exhaustive();
};

export const useBoardItemActivation = ({
	feedback,
	onOpenSheet,
}: useBoardItemActivation.Props): useBoardItemActivation.Result => {
	const runtimeStore = useGameRuntimeStore();

	return useCallback(
		(boardItemId: string, expectedItemId: string) => {
			const context = readBoardItemActivationContext({
				boardItemId,
				expectedItemId,
				feedback,
				onOpenSheet,
				runtimeStore,
			});
			if (!context) return;
			handleResolvedBoardItemTapAction({
				context,
			});
		},
		[
			feedback,
			onOpenSheet,
			runtimeStore,
		],
	);
};
