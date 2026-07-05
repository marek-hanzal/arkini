import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameAudioPlanWriter } from "~/audio/GameAudioPlanWriter";

export const pushGameAudioSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: GameAudioPlanWriter & {
	soundId: GameAudioSoundId;
	sourceEventType: string;
}) => {
	plan.entries.push({
		soundId,
		sourceEventType,
	});
	flags.playedSoundIds.add(soundId);
};
