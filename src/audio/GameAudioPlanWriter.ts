import type { GameAudioPlan } from "~/audio/GameAudioPlan";
import type { GameAudioPlanFlags } from "~/audio/GameAudioPlanFlags";

export interface GameAudioPlanWriter {
	flags: GameAudioPlanFlags;
	plan: GameAudioPlan.Type;
}
