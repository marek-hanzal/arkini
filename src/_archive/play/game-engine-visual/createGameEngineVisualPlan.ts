import type { GameEngineVisualPlan } from "~/play/game-engine-visual/GameEngineVisualPlan";
import { appendDeferredVisualPlanEvents } from "~/play/game-engine-visual/appendDeferredVisualPlanEvents";
import { appendVisualPlanEvent } from "~/play/game-engine-visual/appendVisualPlanEvent";
import { createGameEngineVisualPlanContext } from "~/play/game-engine-visual/createGameEngineVisualPlanContext";
import type { GameEngineVisualPlanProps } from "~/play/game-engine-visual/GameEngineVisualPlanProps";

export namespace createGameEngineVisualPlan {
	export type Props = GameEngineVisualPlanProps;
}

export const createGameEngineVisualPlan = (
	props: createGameEngineVisualPlan.Props,
): GameEngineVisualPlan => {
	const context = createGameEngineVisualPlanContext(props);

	for (const [index, event] of props.events.entries()) {
		if (context.skipped.has(index)) continue;
		appendVisualPlanEvent({
			context,
			event,
			index,
		});
	}

	appendDeferredVisualPlanEvents(context);
	return context.plan;
};
