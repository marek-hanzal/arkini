import { match } from "ts-pattern";
import type { GameEventOfType } from "~/event/GameEventOfType";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";

export const pushItemRemovedAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"item.removed">,
) =>
	match(event.reason)
		.with("producer-depleted", () =>
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.producer.depleted",
				sourceEventType: event.type,
			}),
		)
		.with("tile-remove", () =>
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.tile.remove",
				sourceEventType: event.type,
			}),
		)
		.with("debug-delete", "capacity-depleted", "merge-result", "craft-result", () => undefined)
		.exhaustive();
