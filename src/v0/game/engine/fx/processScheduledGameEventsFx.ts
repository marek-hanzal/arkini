import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { processScheduledGameEventFx } from "~/v0/game/engine/fx/processScheduledGameEventFx";
import { readDueScheduledGameEventsFx } from "~/v0/game/engine/fx/readDueScheduledGameEventsFx";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processScheduledGameEventsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const processScheduledGameEventsFx = Effect.fn("processScheduledGameEventsFx")(function* ({
	config,
	save,
	nowMs,
}: processScheduledGameEventsFx.Props) {
	let nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const processedExclusiveKeys = new Set<string>();
	const dueEvents = yield* readDueScheduledGameEventsFx({
		nowMs,
		save: nextSave,
	});

	for (const scheduledEvent of dueEvents) {
		if (
			scheduledEvent.exclusiveKey &&
			processedExclusiveKeys.has(scheduledEvent.exclusiveKey)
		) {
			continue;
		}

		const result = yield* processScheduledGameEventFx({
			config,
			nowMs,
			save: nextSave,
			scheduledEvent,
		});

		if (scheduledEvent.exclusiveKey) {
			processedExclusiveKeys.add(scheduledEvent.exclusiveKey);
		}

		if (result.type === "blocked") {
			events.push(result.event);
			continue;
		}

		nextSave = result.save;
		events.push(...result.events);
	}

	return {
		events,
		save: nextSave,
	};
});
