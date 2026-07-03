import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { GameEvent } from "~/event/GameEventSchema";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineExitMotion } from "~/play/game-engine-visual/toTileEngineExitMotion";

type MemoryStoreEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;

export namespace appendBoardMemoryStoreVisuals {
	export interface Props {
		event: MemoryStoreEvent;
		plan: GameEngineVisualPlanDraft;
		previousBoard: BoardView | undefined;
		sequenceIndex: number;
	}
}

export const appendBoardMemoryStoreVisuals = ({
	event,
	plan,
	previousBoard,
	sequenceIndex,
}: appendBoardMemoryStoreVisuals.Props) => {
	if (event.from.kind !== "board") return;
	const previousSource = previousBoard?.byId[event.from.itemInstanceId];
	if (!previousSource) return;
	const memoryItem = previousBoard?.items.find((item) => item.itemId === boardMemoryItemId);
	if (!memoryItem) return;

	const motion = GameVisualMotion.merge({
		cause: "memory",
		durationMs: 620,
		groupId: `engine:memory-store:${event.from.itemInstanceId}:${sequenceIndex}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const tile: BoardTransientTile = {
		groupId: motion.groupId,
		id: `transient:memory-store:${motion.groupId}:source:${previousSource.id}`,
		itemId: event.itemId as BoardTransientTile["itemId"],
		slotId: cellKey(previousSource.x, previousSource.y),
	};

	plan.boardTransientTilePlans.push({
		cleanupDelayMs,
		groupId: motion.groupId,
		request: {
			cleanupDelayMs,
			exit: toTileEngineExitMotion(motion, {
				toTileId: memoryItem.id,
			}),
			tileId: tile.id,
		},
		tile,
	});
};
