import type { GameAudioBatchFacts } from "~/audio/GameAudioBatchFacts";
import type { GameAudioPlanProps } from "~/audio/GameAudioPlanProps";
import type { GameAudioPlanWriter } from "~/audio/GameAudioPlanWriter";

export interface GameAudioPlanContext
	extends GameAudioPlanProps,
		GameAudioPlanWriter,
		GameAudioBatchFacts {}
