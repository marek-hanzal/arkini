import { Effect } from "effect";
import { createGameScheduledEventIdFx } from "~/v0/game/engine/fx/createGameScheduledEventIdFx";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace scheduleGameItemSpawnsFx {
	export interface Props {
		save: GameSave;
		items: GameSaveItemPlacementRequest[];
		dueAtMs: number;
		exclusiveKey?: string;
		intervalMs?: number;
	}
}

export const scheduleGameItemSpawnsFx = Effect.fn("scheduleGameItemSpawnsFx")(function* ({
	save,
	items,
	dueAtMs,
	exclusiveKey,
	intervalMs = 0,
}: scheduleGameItemSpawnsFx.Props) {
	let scheduledIndex = 0;
	let lastDueAtMs = dueAtMs;
	const eventIds: string[] = [];

	for (const item of items) {
		for (let quantityIndex = 0; quantityIndex < item.quantity; quantityIndex += 1) {
			const scheduledDueAtMs = dueAtMs + scheduledIndex * intervalMs;
			lastDueAtMs = scheduledDueAtMs;
			const id = yield* createGameScheduledEventIdFx({
				save,
			});
			save.scheduledEvents[id] = {
				dueAtMs: scheduledDueAtMs,
				exclusiveKey,
				id,
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				quantity: 1,
				reason: item.reason,
				type: "item.spawn",
			};
			eventIds.push(id);
			scheduledIndex += 1;
		}
	}

	return {
		eventIds,
		lastDueAtMs,
		save,
	};
});
