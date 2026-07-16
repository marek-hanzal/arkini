import { appendActivationInputTargetFeedback } from "~/play/game-engine-visual/appendActivationInputTargetFeedback";
import { appendCraftStageUpdateVisuals } from "~/play/game-engine-visual/appendCraftStageUpdateVisuals";
import type { ActivationInputStoredEvent } from "~/play/game-engine-visual/ActivationInputStoredEvent";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendActivationInputStoredTargetVisuals = (
	context: GameEngineVisualPlanContext,
	target: ActivationInputStoredEvent,
) => {
	if (target.type === "craft_input.stored") {
		if (context.animatedCraftStageTargetIds.has(target.targetItemInstanceId)) return;

		context.animatedCraftStageTargetIds.add(target.targetItemInstanceId);
		appendCraftStageUpdateVisuals({
			currentBoard: context.currentBoard,
			plan: context.plan,
			previousBoard: context.previousBoard,
			target,
		});
		return;
	}

	appendActivationInputTargetFeedback({
		plan: context.plan,
		target,
	});
};
