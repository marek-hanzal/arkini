import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processScheduledGameEventFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		scheduledEvent: GameSaveScheduledEvent;
		nowMs: number;
	}
}

export const processScheduledGameEventFx = Effect.fn("processScheduledGameEventFx")(function* ({
	config,
	save,
	scheduledEvent,
	nowMs,
}: processScheduledGameEventFx.Props) {
	const placement = yield* placeGameSaveItemsFx({
		config,
		items: [
			{
				itemId: scheduledEvent.itemId,
				originItemInstanceId: scheduledEvent.originItemInstanceId,
				quantity: scheduledEvent.quantity,
				reason: scheduledEvent.reason,
			},
		],
		nowMs,
		save,
	});

	if (placement.type === "blocked") {
		return {
			event: {
				blockedAtMs: nowMs,
				itemId: scheduledEvent.itemId,
				reason: "placement_unavailable" as const,
				scheduledEventId: scheduledEvent.id,
				type: "item.spawn.blocked" as const,
			},
			type: "blocked" as const,
		} satisfies GameEngineCompletionResult;
	}

	delete placement.save.scheduledEvents[scheduledEvent.id];
	placement.save.updatedAtMs = nowMs;

	return {
		events: placement.events,
		save: placement.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
