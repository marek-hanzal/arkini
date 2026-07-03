import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineEnterMotion } from "~/play/game-engine-visual/toTileEngineEnterMotion";

type MemoryRestoreEvent = Extract<
	GameEvent,
	{
		type: "item.created";
	}
>;

export namespace appendBoardMemoryRestoreVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		event: MemoryRestoreEvent;
		plan: GameEngineVisualPlanDraft;
		sequenceIndex: number;
	}
}

const memoryRestoreBaseDelayMs = 260;
const memoryRestoreSequenceDelayMs = 34;
const memoryRestoreDurationMs = 280;

export const appendBoardMemoryRestoreVisuals = ({
	currentBoard,
	event,
	plan,
	sequenceIndex,
}: appendBoardMemoryRestoreVisuals.Props) => {
	if (event.to.kind !== "board") return;
	if (!currentBoard?.byId[event.to.itemInstanceId]) return;

	const motion = GameVisualMotion.sequenceFadeIn({
		cause: "memory",
		delayMs: memoryRestoreBaseDelayMs + sequenceIndex * memoryRestoreSequenceDelayMs,
		durationMs: memoryRestoreDurationMs,
		groupId: `engine:memory-restore:${event.to.itemInstanceId}:${sequenceIndex}`,
		sequenceIndex,
	});
	plan.boardEnterRequests.push({
		cleanupDelayMs: gameVisualMotionSettlementDelayMs(motion),
		enter: toTileEngineEnterMotion(motion, {
			fromTileId: event.originItemInstanceId,
		}),
		tileId: event.to.itemInstanceId,
	});
};
