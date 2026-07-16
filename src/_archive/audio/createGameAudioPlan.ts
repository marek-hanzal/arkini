import type { GameAudioPlan } from "~/audio/GameAudioPlan";
import type { GameAudioPlanProps } from "~/audio/GameAudioPlanProps";
import { createGameAudioPlanContext } from "~/audio/createGameAudioPlanContext";
import { pushGameAudioEvent } from "~/audio/pushGameAudioEvent";

export namespace createGameAudioPlan {
	export type Props = GameAudioPlanProps;
}

export const createGameAudioPlan = (props: createGameAudioPlan.Props): GameAudioPlan.Type => {
	const context = createGameAudioPlanContext(props);

	for (const event of props.events) {
		pushGameAudioEvent(context, event);
	}

	return context.plan;
};
