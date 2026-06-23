import { cellKey } from "~/v0/board/cellKey";
import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { TileEngineTiming } from "~/v0/tile-engine";

export namespace appendStashDepletedRetainedTile {
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

const stashExitDurationMs = 1;

const readRetainedTileExitDelayMs = ({
	plan,
	stashItemInstanceId,
}: {
	plan: GameEngineVisualPlanDraft;
	stashItemInstanceId: string;
}) => {
	const linkedMotionMilestonesMs = [
		...plan.boardEnterRequests
			.filter((request) => request.enter?.fromTileId === stashItemInstanceId)
			.map((request) => readMotionStartMs(request.enter?.delayMs)),
		...plan.boardTransientTilePlans
			.filter((entry) => entry.request.exit?.toTileId === stashItemInstanceId)
			.map((entry) => readMotionEndMs(entry.cleanupDelayMs)),
	];

	return linkedMotionMilestonesMs.length ? Math.max(...linkedMotionMilestonesMs) : 0;
};

export const appendStashDepletedRetainedTile = ({
	currentBoard,
	event,
	plan,
	previousBoard,
}: appendStashDepletedRetainedTile.Props) => {
	if (event.reason !== "stash-depleted") return;
	if (currentBoard?.byId[event.itemInstanceId]) return;

	const previousItem = previousBoard?.byId[event.itemInstanceId];
	if (!previousItem) return;

	const delayMs = readRetainedTileExitDelayMs({
		plan,
		stashItemInstanceId: event.itemInstanceId,
	});
	const durationMs = stashExitDurationMs;
	const groupId = `engine:stash-retain:${event.itemInstanceId}:${event.removedAtMs}`;
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
