import { match } from "ts-pattern";
import type { GameEventOfType } from "~/event/GameEventOfType";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";

export const pushItemConsumedAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"item.consumed">,
) =>
	match(event.reason)
		.with("board-stash", () => {
			if (context.hasBoardStashCreated) return;
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.board.stash",
				sourceEventType: event.type,
			});
		})
		.with("merge-source", () => undefined)
		.with(
			"line-input",
			"producer-input-store",
			"producer-input-auto-fill",
			"craft-input",
			"craft-input-store",
			"craft-input-auto-fill",
			"inventory-placement",
			"remove-tool",
			"memory-restore",
			"memory-store",
			() => undefined,
		)
		.exhaustive();
