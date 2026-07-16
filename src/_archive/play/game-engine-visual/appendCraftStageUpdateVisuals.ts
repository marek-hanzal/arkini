import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { appendBoardTargetTransformVisuals } from "~/play/game-engine-visual/appendBoardTargetTransformVisuals";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";

type CraftInputStoredEvent = Extract<
	GameEvent,
	{
		type: "craft_input.stored";
	}
>;

export namespace appendCraftStageUpdateVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		previousBoard: BoardView | undefined;
		plan: GameEngineVisualPlanDraft;
		target: CraftInputStoredEvent;
	}
}

export const appendCraftStageUpdateVisuals = ({
	currentBoard,
	previousBoard,
	plan,
	target,
}: appendCraftStageUpdateVisuals.Props) => {
	const previousTarget = previousBoard?.byId[target.targetItemInstanceId];
	const currentTarget = currentBoard?.byId[target.targetItemInstanceId];
	if (!previousTarget || !currentTarget) return;

	const motion = GameVisualMotion.stageUpdate({
		cause: "craft",
		groupId: `engine:craft-stage:${target.targetItemInstanceId}:${target.itemId}:${target.atMs}`,
	});

	appendBoardTargetTransformVisuals({
		assetProgress: previousTarget.craft?.inputProgress,
		currentTarget,
		motion,
		plan,
		previousTarget,
		transientId: `transient:craft-stage:${motion.groupId}:target:${previousTarget.id}`,
	});
};
