import { match } from "ts-pattern";
import type { GameEventOfType } from "~/event/GameEventOfType";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";

export const pushItemReplacedAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"item.replaced">,
) =>
	match(event.reason)
		.with("merge-result", () =>
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.merge.success",
				sourceEventType: event.type,
			}),
		)
		.with("craft-result", () => {
			if (context.hasCraftCompleted) return;
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.craft.result.replace",
				sourceEventType: event.type,
			});
		})
		.with(
			"debug-delete",
			"capacity-depleted",
			"producer-depleted",
			"tile-remove",
			() => undefined,
		)
		.exhaustive();
