import { match } from "ts-pattern";
import type { GameAudioPlanContext } from "~/audio/GameAudioPlanContext";
import { pushBoardMemoryAudio } from "~/audio/pushBoardMemoryAudio";
import { pushCheatSpeedAudio } from "~/audio/pushCheatSpeedAudio";
import { pushItemConsumedAudio } from "~/audio/pushItemConsumedAudio";
import { pushItemCreatedAudio } from "~/audio/pushItemCreatedAudio";
import { pushItemRemovedAudio } from "~/audio/pushItemRemovedAudio";
import { pushItemReplacedAudio } from "~/audio/pushItemReplacedAudio";
import { pushLineLifecycleAudio } from "~/audio/pushLineLifecycleAudio";
import type { NonStaticGameAudioEvent } from "~/audio/staticGameAudioSoundByEventType";

export const pushNonStaticGameAudioEvent = (
	context: GameAudioPlanContext,
	event: NonStaticGameAudioEvent,
) =>
	match(event)
		.with(
			{
				type: "item.created",
			},
			(matchedEvent) => pushItemCreatedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "item.consumed",
			},
			(matchedEvent) => pushItemConsumedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "item.removed",
			},
			(matchedEvent) => pushItemRemovedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "item.replaced",
			},
			(matchedEvent) => pushItemReplacedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "line.started",
			},
			(matchedEvent) => pushLineLifecycleAudio(context, matchedEvent),
		)
		.with(
			{
				type: "line.completed",
			},
			(matchedEvent) => pushLineLifecycleAudio(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.saved",
			},
			(matchedEvent) => pushBoardMemoryAudio(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.restored",
			},
			(matchedEvent) => pushBoardMemoryAudio(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.cleared",
			},
			(matchedEvent) => pushBoardMemoryAudio(context, matchedEvent),
		)
		.with(
			{
				type: "cheat.speed_mode.changed",
			},
			(matchedEvent) => pushCheatSpeedAudio(context, matchedEvent),
		)
		.exhaustive();
