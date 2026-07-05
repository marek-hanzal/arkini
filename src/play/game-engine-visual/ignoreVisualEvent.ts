import type { GameEvent } from "~/event/GameEventSchema";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const ignoreVisualEvent = ({ plan }: GameEngineVisualPlanContext, event: GameEvent) => {
	plan.ignoredEventTypes.push(event.type);
};
