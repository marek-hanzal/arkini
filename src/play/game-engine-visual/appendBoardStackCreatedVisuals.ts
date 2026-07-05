import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { boardStackFeedbackDurationMs } from "~/play/game-engine-visual/boardStackFeedbackDurationMs";
import { boardStackFlyDurationMs } from "~/play/game-engine-visual/boardStackFlyDurationMs";
import { createBoardTileBounceFeedbackRequest } from "~/play/game-engine-visual/createBoardTileBounceFeedbackRequest";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import { readBoardStackFeedbackDelayMs } from "~/play/game-engine-visual/readBoardStackFeedbackDelayMs";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineExitMotion } from "~/play/game-engine-visual/toTileEngineExitMotion";

export type StackCreatedEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;

export type StackConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;

export namespace appendBoardStackCreatedVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		event: StackCreatedEvent;
		plan: GameEngineVisualPlanDraft;
		previousBoard: BoardView | undefined;
		sequenceIndex: number;
		source?: StackConsumedEvent;
	}
}

const readBoardStackSourceTile = ({
	event,
	previousBoard,
	source,
}: Pick<appendBoardStackCreatedVisuals.Props, "event" | "previousBoard" | "source">) => {
	if (source?.from.kind === "board") {
		return previousBoard?.byId[source.from.itemInstanceId];
	}

	if (event.originItemInstanceId) {
		return previousBoard?.byId[event.originItemInstanceId];
	}

	return undefined;
};

const readTransientQuantity = ({
	event,
	source,
}: Pick<appendBoardStackCreatedVisuals.Props, "event" | "source">) => {
	const quantity = source?.from.quantity ?? event.to.quantity ?? 1;
	return quantity > 1 ? quantity : undefined;
};

export const appendBoardStackCreatedVisuals = ({
	currentBoard,
	event,
	plan,
	previousBoard,
	sequenceIndex,
	source,
}: appendBoardStackCreatedVisuals.Props) => {
	if (event.to.kind !== "board") return false;

	const previousTarget = previousBoard?.byId[event.to.itemInstanceId];
	const currentTarget = currentBoard?.byId[event.to.itemInstanceId];
	if (!previousTarget || !currentTarget) return false;

	const sourceTile = readBoardStackSourceTile({
		event,
		previousBoard,
		source,
	});
	const groupId = `engine:board-stack:${sourceTile?.id ?? event.originItemInstanceId ?? event.itemId}:${currentTarget.id}:${sequenceIndex}`;
	const motion = GameVisualMotion.merge({
		cause: "merge",
		durationMs: boardStackFlyDurationMs,
		groupId,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);

	if (sourceTile && sourceTile.id !== currentTarget.id) {
		const transientTile: BoardTransientTile = {
			groupId,
			id: `transient:board-stack:${groupId}:source:${sourceTile.id}`,
			itemId: event.itemId as BoardTransientTile["itemId"],
			quantity: readTransientQuantity({
				event,
				source,
			}),
			slotId: cellKey(sourceTile.x, sourceTile.y),
		};

		plan.boardTransientTilePlans.push({
			cleanupDelayMs,
			groupId,
			request: {
				cleanupDelayMs,
				exit: toTileEngineExitMotion(motion, {
					toTileId: currentTarget.id,
				}),
				tileId: transientTile.id,
			},
			tile: transientTile,
		});
	}

	plan.boardFeedbackRequests.push(
		createBoardTileBounceFeedbackRequest({
			delayMs:
				sourceTile && sourceTile.id !== currentTarget.id
					? readBoardStackFeedbackDelayMs(motion)
					: 0,
			durationMs: boardStackFeedbackDurationMs,
			groupId,
			tileId: currentTarget.id,
		}),
	);

	return true;
};
