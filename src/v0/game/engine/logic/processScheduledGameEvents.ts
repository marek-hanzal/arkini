import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSave } from "~/v0/game/engine/logic/cloneGameSave";
import { placeGameSaveItems } from "~/v0/game/engine/logic/placeGameSaveItems";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave, GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export interface ProcessScheduledGameEventsInput {
	config: GameConfig;
	save: GameSave;
	nowMs: number;
}

export interface ProcessScheduledGameEventsResult {
	save: GameSave;
	events: GameEvent[];
}

export const processScheduledGameEvents = ({
	config,
	save,
	nowMs,
}: ProcessScheduledGameEventsInput): ProcessScheduledGameEventsResult => {
	let nextSave = cloneGameSave(save);
	const events: GameEvent[] = [];
	const processedExclusiveKeys = new Set<string>();

	for (const scheduledEvent of readDueScheduledEvents(nextSave, nowMs)) {
		if (
			scheduledEvent.exclusiveKey &&
			processedExclusiveKeys.has(scheduledEvent.exclusiveKey)
		) {
			continue;
		}

		const result = processScheduledEvent({
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
};

const readDueScheduledEvents = (save: GameSave, nowMs: number) =>
	Object.values(save.scheduledEvents)
		.filter((event) => event.dueAtMs <= nowMs)
		.sort(compareScheduledEvents);

const compareScheduledEvents = (left: GameSaveScheduledEvent, right: GameSaveScheduledEvent) =>
	left.dueAtMs - right.dueAtMs || left.id.localeCompare(right.id);

type ProcessScheduledEventResult =
	| {
			type: "completed";
			save: GameSave;
			events: GameEvent[];
	  }
	| {
			type: "blocked";
			event: GameEvent;
	  };

const processScheduledEvent = ({
	config,
	save,
	scheduledEvent,
	nowMs,
}: {
	config: GameConfig;
	save: GameSave;
	scheduledEvent: GameSaveScheduledEvent;
	nowMs: number;
}): ProcessScheduledEventResult => {
	switch (scheduledEvent.type) {
		case "item.spawn": {
			const placement = placeGameSaveItems({
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
						reason: "placement_unavailable",
						scheduledEventId: scheduledEvent.id,
						type: "item.spawn.blocked",
					},
					type: "blocked",
				};
			}

			delete placement.save.scheduledEvents[scheduledEvent.id];
			placement.save.updatedAtMs = nowMs;

			return {
				events: placement.events,
				save: placement.save,
				type: "completed",
			};
		}
	}
};
