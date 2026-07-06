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

export namespace appendBoardStackCreatedVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		event: StackCreatedEvent;
		plan: GameEngineVisualPlanDraft;
		previousBoard: BoardView | undefined;
		sequenceIndex: number;
	}
}

const readBoardStackOriginTile = ({
	event,
	previousBoard,
}: Pick<appendBoardStackCreatedVisuals.Props, "event" | "previousBoard">) => {
	if (!event.originItemInstanceId) return undefined;
	return previousBoard?.byId[event.originItemInstanceId];
};

const readTransientQuantity = (event: StackCreatedEvent) => {
	const quantity = event.to.quantity ?? 1;
	return quantity > 1 ? quantity : undefined;
};

export const appendBoardStackCreatedVisuals = ({
	currentBoard,
	event,
	plan,
	previousBoard,
	sequenceIndex,
}: appendBoardStackCreatedVisuals.Props) => {
	if (event.to.kind !== "board") return false;

	const previousTarget = previousBoard?.byId[event.to.itemInstanceId];
	const currentTarget = currentBoard?.byId[event.to.itemInstanceId];
	if (!previousTarget || !currentTarget) return false;

	// Board-stack item.created events have two distinct visual meanings:
	// - line/craft/stash output into an existing stack has an origin tile and gets a fly animation;
	// - manual board DnD stack already moved the live actor and should only bounce the target.
	const originTile = readBoardStackOriginTile({
		event,
		previousBoard,
	});
	const groupId = `engine:board-stack:${originTile?.id ?? event.originItemInstanceId ?? event.itemId}:${currentTarget.id}:${sequenceIndex}`;
	const motion = GameVisualMotion.merge({
		cause: "merge",
		durationMs: boardStackFlyDurationMs,
		groupId,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);

	if (originTile && originTile.id !== currentTarget.id) {
		const transientTile: BoardTransientTile = {
			groupId,
			id: `transient:board-stack:${groupId}:source:${originTile.id}`,
			itemId: event.itemId as BoardTransientTile["itemId"],
			quantity: readTransientQuantity(event),
			slotId: cellKey(originTile.x, originTile.y),
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
				originTile && originTile.id !== currentTarget.id
					? readBoardStackFeedbackDelayMs(motion)
					: 0,
			durationMs: boardStackFeedbackDurationMs,
			groupId,
			tileId: currentTarget.id,
		}),
	);

	return true;
};
