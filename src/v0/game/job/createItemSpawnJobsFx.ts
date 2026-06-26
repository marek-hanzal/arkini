import { Effect } from "effect";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import { createGameItemSpawnJobIdFx } from "~/v0/game/job/createGameItemSpawnJobIdFx";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace createItemSpawnJobsFx {
	export interface Props {
		save: GameSave;
		items: GameSaveItemPlacementRequest[];
		readyAtMs: number;
		exclusiveGroupKey?: string;
		intervalMs?: number;
		seedCell?: BoardCell;
	}
}

export const createItemSpawnJobsFx = Effect.fn("createItemSpawnJobsFx")(function* ({
	save,
	items,
	readyAtMs,
	exclusiveGroupKey,
	intervalMs = 0,
	seedCell,
}: createItemSpawnJobsFx.Props) {
	let itemSpawnIndex = 0;
	let lastDueAtMs = readyAtMs;
	const jobIds: string[] = [];

	for (const item of items) {
		for (let quantityIndex = 0; quantityIndex < item.quantity; quantityIndex += 1) {
			const itemSpawnDueAtMs = readyAtMs + itemSpawnIndex * intervalMs;
			lastDueAtMs = itemSpawnDueAtMs;
			const id = yield* createGameItemSpawnJobIdFx();
			save.itemSpawnJobs[id] = {
				readyAtMs: itemSpawnDueAtMs,
				exclusiveGroupKey,
				id,
				itemId: item.itemId,
				originItemInstanceId: item.originItemInstanceId,
				quantity: 1,
				reason: item.reason,
				seedCell,
				sequenceIndex: itemSpawnIndex,
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
