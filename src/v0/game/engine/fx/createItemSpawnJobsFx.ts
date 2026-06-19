import { Effect } from "effect";
import { createGameItemSpawnJobIdFx } from "~/v0/game/engine/fx/createGameItemSpawnJobIdFx";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace createItemSpawnJobsFx {
	export interface Props {
		save: GameSave;
		items: GameSaveItemPlacementRequest[];
		dueAtMs: number;
		exclusiveGroupKey?: string;
		intervalMs?: number;
	}
}

export const createItemSpawnJobsFx = Effect.fn("createItemSpawnJobsFx")(function* ({
	save,
	items,
	dueAtMs,
	exclusiveGroupKey,
	intervalMs = 0,
}: createItemSpawnJobsFx.Props) {
	let itemSpawnIndex = 0;
	let lastDueAtMs = dueAtMs;
	const jobIds: string[] = [];

	for (const item of items) {
		for (let quantityIndex = 0; quantityIndex < item.quantity; quantityIndex += 1) {
			const itemSpawnDueAtMs = dueAtMs + itemSpawnIndex * intervalMs;
			lastDueAtMs = itemSpawnDueAtMs;
			const id = yield* createGameItemSpawnJobIdFx();
			save.itemSpawnJobs[id] = {
				dueAtMs: itemSpawnDueAtMs,
				exclusiveGroupKey,
				id,
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				quantity: 1,
				reason: item.reason,
				type: "item.spawn",
			};
			jobIds.push(id);
			itemSpawnIndex += 1;
		}
	}

	return {
		jobIds,
		lastDueAtMs,
		save,
	};
});
