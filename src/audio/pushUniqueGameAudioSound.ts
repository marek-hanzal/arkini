import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameAudioPlanWriter } from "~/audio/GameAudioPlanWriter";
import { pushGameAudioSound } from "~/audio/pushGameAudioSound";

export const pushUniqueGameAudioSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: GameAudioPlanWriter & {
	soundId: GameAudioSoundId;
	sourceEventType: string;
}) => {
	if (flags.playedSoundIds.has(soundId)) return;
	pushGameAudioSound({
		flags,
		plan,
		soundId,
		sourceEventType,
	});
};
