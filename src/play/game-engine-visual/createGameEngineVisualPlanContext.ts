import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import type { GameEngineVisualPlanProps } from "~/play/game-engine-visual/GameEngineVisualPlanProps";

const readBoardMemoryItemInstanceId = (events: readonly GameEvent[]) =>
	events.find(
		(event) =>
			event.type === "board.memory.saved" ||
			event.type === "board.memory.restored" ||
			event.type === "board.memory.cleared",
	)?.boardItemId;

export const createGameEngineVisualPlanContext = (
	props: GameEngineVisualPlanProps,
): GameEngineVisualPlanContext => ({
	...props,
	animatedCraftStageTargetIds: new Set<string>(),
	boardMemoryItemInstanceId: readBoardMemoryItemInstanceId(props.events),
	createdSequenceIndex: 0,
	deferredStashDepletionRemovals: [],
	memoryRestoreSequenceIndex: 0,
	plan: createGameEngineVisualPlanDraft(),
	skipped: new Set<number>(),
});
