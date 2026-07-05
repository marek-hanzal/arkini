import { match } from "ts-pattern";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";
import type { GameEventOfType } from "~/event/GameEventOfType";

export const pushCheatSpeedAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"cheat.speed_mode.changed">,
) =>
	pushUniqueGameAudioSound({
		...context,
		soundId: match(event.nextMode)
			.with("instant", () => "audio.cheat.speed.enable" as const)
			.with("normal", () => "audio.cheat.speed.disable" as const)
			.exhaustive(),
		sourceEventType: event.type,
	});
