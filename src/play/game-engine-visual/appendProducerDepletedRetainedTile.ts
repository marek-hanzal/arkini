import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";

export namespace appendProducerDepletedRetainedTile {
	export interface Props {
		currentBoard: BoardView | undefined;
		event: Extract<
			GameEvent,
			{
				type: "item.removed";
			}
		>;
		plan: GameEngineVisualPlanDraft;
		previousBoard: BoardView | undefined;
	}
}

const readMotionStartMs = (delayMs: number | undefined) => Math.max(0, delayMs ?? 0);

const readMotionEndMs = (cleanupDelayMs: number | undefined) =>
	Math.max(0, (cleanupDelayMs ?? 0) - TileEngineTiming.motionCleanupBufferMs);

const producerExitDurationMs = 1;

const readRetainedTileExitDelayMs = ({
	plan,
	itemInstanceId,
}: {
	plan: GameEngineVisualPlanDraft;
	itemInstanceId: string;
}) => {
	const linkedMotionMilestonesMs = [
		...plan.boardEnterRequests
			.filter((request) => request.enter?.fromTileId === itemInstanceId)
			.map((request) => readMotionStartMs(request.enter?.delayMs)),
		...plan.boardTransientTilePlans
			.filter((entry) => entry.request.exit?.toTileId === itemInstanceId)
			.map((entry) => readMotionEndMs(entry.cleanupDelayMs)),
	];

	return linkedMotionMilestonesMs.length ? Math.max(...linkedMotionMilestonesMs) : 0;
};

export const appendProducerDepletedRetainedTile = ({
	currentBoard,
	event,
	plan,
	previousBoard,
}: appendProducerDepletedRetainedTile.Props) => {
	if (event.reason !== "producer-depleted") return;
	if (currentBoard?.byId[event.itemInstanceId]) return;

	const previousItem = previousBoard?.byId[event.itemInstanceId];
	if (!previousItem) return;

	const delayMs = readRetainedTileExitDelayMs({
		plan,
		itemInstanceId: event.itemInstanceId,
	});
	const durationMs = producerExitDurationMs;
	const groupId = `engine:producer-depleted-retain:${event.itemInstanceId}:${event.atMs}`;
	const cleanupDelayMs = delayMs + durationMs + TileEngineTiming.motionCleanupBufferMs;
	const tile: BoardTransientTile = {
		groupId,
		id: event.itemInstanceId,
		itemId: event.itemId as BoardTransientTile["itemId"],
		slotId: cellKey(previousItem.x, previousItem.y),
	};

	plan.boardTransientTilePlans.push({
		cleanupDelayMs,
		groupId,
		request: {
			cleanupDelayMs,
			exit: {
				delayMs,
				durationMs,
				groupId,
				kind: "merge-out",
			},
			tileId: tile.id,
		},
		tile,
	});
};
