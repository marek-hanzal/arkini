import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";
import { readLineLifecycleAudioSoundId } from "~/audio/readLineLifecycleAudioSoundId";
import type { GameEventOfType } from "~/event/GameEventOfType";

export const pushLineLifecycleAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"line.started" | "line.completed">,
) =>
	pushUniqueGameAudioSound({
		...context,
		soundId: readLineLifecycleAudioSoundId(context, event),
		sourceEventType: event.type,
	});
