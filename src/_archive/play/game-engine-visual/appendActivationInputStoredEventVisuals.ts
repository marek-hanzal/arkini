import type { ActivationInputStoredEvent } from "~/play/game-engine-visual/ActivationInputStoredEvent";
import { appendActivationInputStoredTargetVisuals } from "~/play/game-engine-visual/appendActivationInputStoredTargetVisuals";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendActivationInputStoredEventVisuals = (
	context: GameEngineVisualPlanContext,
	event: ActivationInputStoredEvent,
) => appendActivationInputStoredTargetVisuals(context, event);
