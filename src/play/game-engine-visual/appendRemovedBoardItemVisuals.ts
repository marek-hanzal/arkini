import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { TileEngineTiming } from "~/tile-engine/TileEngineTiming";
import { tileRemoveDurationMs } from "~/tile-engine/TileRemoveMotion";

export namespace appendRemovedBoardItemVisuals {
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

export const appendRemovedBoardItemVisuals = ({
	currentBoard,
	event,
	plan,
	previousBoard,
}: appendRemovedBoardItemVisuals.Props) => {
	if (currentBoard?.byId[event.itemInstanceId]) return;

	const previousItem = previousBoard?.byId[event.itemInstanceId];
	if (!previousItem) return;

	const delayMs =
		event.reason === "producer-depleted"
			? readRetainedTileExitDelayMs({
					plan,
					itemInstanceId: event.itemInstanceId,
				})
			: 0;
	const durationMs = tileRemoveDurationMs;
	const groupId = `engine:item-removed:${event.reason}:${event.itemInstanceId}:${event.atMs}`;
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
				kind: "remove",
			},
			tileId: tile.id,
		},
		tile,
	});
};
