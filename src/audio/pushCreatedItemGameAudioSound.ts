import { gameAudioCreatedSoundLimit } from "~/audio/GameAudioCreatedSoundLimit";
import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameAudioPlanWriter } from "~/audio/GameAudioPlanWriter";
import { pushGameAudioSound } from "~/audio/pushGameAudioSound";

export const pushCreatedItemGameAudioSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: GameAudioPlanWriter & {
	soundId: GameAudioSoundId;
	sourceEventType: string;
}) => {
	if (flags.createdItemSoundCount >= gameAudioCreatedSoundLimit) return;
	flags.createdItemSoundCount += 1;
	pushGameAudioSound({
		flags,
		plan,
		soundId,
		sourceEventType,
	});
};
