import { match } from "ts-pattern";
import type { GameEventOfType } from "~/event/GameEventOfType";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushCreatedItemGameAudioSound } from "~/audio/pushCreatedItemGameAudioSound";
import { pushUniqueGameAudioSound } from "~/audio/pushUniqueGameAudioSound";

export const pushItemCreatedAudio = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"item.created">,
) =>
	match(event.reason)
		.with("inventory-placement", () => {
			if (event.to.kind !== "board") return;
			pushCreatedItemGameAudioSound({
				...context,
				soundId: "audio.inventory.place",
				sourceEventType: event.type,
			});
		})
		.with("board-stash", () =>
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.board.stash",
				sourceEventType: event.type,
			}),
		)
		.with("tile-remove-output", () =>
			pushCreatedItemGameAudioSound({
				...context,
				soundId: "audio.tile.remove.output",
				sourceEventType: event.type,
			}),
		)
		.with("merge-output", () =>
			pushCreatedItemGameAudioSound({
				...context,
				soundId: "audio.merge.output",
				sourceEventType: event.type,
			}),
		)
		.with("debug", () =>
			pushCreatedItemGameAudioSound({
				...context,
				soundId:
					event.to.kind === "board"
						? "audio.debug.spawn.board"
						: "audio.debug.spawn.inventory",
				sourceEventType: event.type,
			}),
		)
		.with("line-output", () => {
			if (context.hasLineCompleted) return;
			pushUniqueGameAudioSound({
				...context,
				soundId: "audio.producer.complete",
				sourceEventType: event.type,
			});
		})
		.with(
			"producer-input-withdraw",
			"craft-input-withdraw",
			"memory-restore",
			"memory-store",
			() => undefined,
		)
		.exhaustive();
