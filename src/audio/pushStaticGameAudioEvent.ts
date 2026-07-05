import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";
import {
	staticGameAudioSoundByEventType,
	type StaticGameAudioEvent,
} from "~/audio/staticGameAudioSoundByEventType";

export const pushStaticGameAudioEvent = (
	context: GameAudioPlanContext,
	event: StaticGameAudioEvent,
) =>
	pushUniqueGameAudioSound({
		...context,
		soundId: staticGameAudioSoundByEventType[event.type],
		sourceEventType: event.type,
	});
