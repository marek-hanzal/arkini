import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";
import type { GameEventOfType } from "~/event/GameEventOfType";

export const pushBoardMemoryAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"board.memory.saved" | "board.memory.restored" | "board.memory.cleared">,
) =>
	pushUniqueGameAudioSound({
		...context,
		soundId: "audio.effect.activated",
		sourceEventType: event.type,
	});
