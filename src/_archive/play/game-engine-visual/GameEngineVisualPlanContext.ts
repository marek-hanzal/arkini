import type { GameEventOfType } from "~/event/GameEventOfType";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import type { GameEngineVisualPlanProps } from "~/play/game-engine-visual/GameEngineVisualPlanProps";

export interface GameEngineVisualPlanContext extends GameEngineVisualPlanProps {
	animatedCraftStageTargetIds: Set<string>;
	boardMemoryItemInstanceId?: string;
	createdSequenceIndex: number;
	deferredStashDepletionRemovals: GameEventOfType<"item.removed">[];
	memoryRestoreOriginTileId?: string;
	memoryRestoreSequenceIndex: number;
	plan: GameEngineVisualPlanDraft;
	skipped: Set<number>;
}
