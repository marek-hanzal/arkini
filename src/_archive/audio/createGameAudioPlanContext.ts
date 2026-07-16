import { createGameAudioPlanFlags } from "~/audio/GameAudioPlanFlags";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import type { GameAudioPlanProps } from "~/audio/GameAudioPlanProps";
import { readGameAudioBatchFacts } from "~/audio/readGameAudioBatchFacts";

export const createGameAudioPlanContext = (props: GameAudioPlanProps): GameAudioPlanContext => ({
	...props,
	...readGameAudioBatchFacts(props.events),
	flags: createGameAudioPlanFlags(),
	plan: {
		entries: [],
	},
});
