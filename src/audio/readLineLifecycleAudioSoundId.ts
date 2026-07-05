import { match } from "ts-pattern";
import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { isStashLineAudioEvent } from "~/audio/isStashLineAudioEvent";
import type { GameEventOfType } from "~/event/GameEventOfType";

export const readLineLifecycleAudioSoundId = (
	context: GameAudioPlanContext,
	event: GameEventOfType<"line.started" | "line.completed">,
): GameAudioSoundId =>
	match(event.type)
		.with("line.started", () =>
			isStashLineAudioEvent({
				...context,
				itemInstanceId: event.itemInstanceId,
			})
				? "audio.stash.open.start"
				: "audio.producer.start",
		)
		.with("line.completed", () =>
			isStashLineAudioEvent({
				...context,
				itemInstanceId: event.itemInstanceId,
			})
				? "audio.stash.release"
				: "audio.producer.complete",
		)
		.exhaustive();
