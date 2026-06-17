import { createGameScheduledEventId } from "~/v0/game/engine/logic/createGameScheduledEventId";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/logic/placeGameSaveItems";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export interface ScheduleGameItemSpawnsInput {
	save: GameSave;
	items: GameSaveItemPlacementRequest[];
	dueAtMs: number;
	exclusiveKey?: string;
	intervalMs?: number;
}

export const scheduleGameItemSpawns = ({
	save,
	items,
	dueAtMs,
	exclusiveKey,
	intervalMs = 0,
}: ScheduleGameItemSpawnsInput): GameSave => {
	let scheduledIndex = 0;

	for (const item of items) {
		for (let quantityIndex = 0; quantityIndex < item.quantity; quantityIndex += 1) {
			const id = createGameScheduledEventId(save);
			save.scheduledEvents[id] = {
				dueAtMs: dueAtMs + scheduledIndex * intervalMs,
				exclusiveKey,
				id,
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				quantity: 1,
				reason: item.reason,
				type: "item.spawn",
			};
			scheduledIndex += 1;
		}
	}

	return save;
};
