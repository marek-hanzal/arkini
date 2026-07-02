import { Effect } from "effect";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { isCheatSpeedItemId, readCheatSpeedItemIdFromMode } from "~/cheat/GameCheatSpeedItem";
import { syncRealtimeWorldJobsFx } from "~/world/syncRealtimeWorldJobsFx";
import type { GameActionCheatSpeedModeSet } from "~/action/GameActionCheatSpeedModeSet";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace setCheatSpeedModeFx {
	export interface Props {
		action: GameActionCheatSpeedModeSet;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const setCheatSpeedModeFx = Effect.fn("setCheatSpeedModeFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: setCheatSpeedModeFx.Props) {
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	nextSave.cheats = {
		...(nextSave.cheats ?? {}),
		speedMode: action.mode,
	};

	const speedModeItemId = readCheatSpeedItemIdFromMode(action.mode);
	for (const boardItem of Object.values(nextSave.board.items)) {
		if (!isCheatSpeedItemId(boardItem.itemId)) continue;

		boardItem.itemId = speedModeItemId;
	}

	for (const slot of nextSave.inventory.slots) {
		if (!slot) continue;
		if (!isCheatSpeedItemId(slot.itemId)) continue;

		slot.itemId = speedModeItemId;
	}

	nextSave.updatedAtMs = nowMs;

	const syncedSave = yield* syncRealtimeWorldJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	syncedSave.updatedAtMs = nowMs;

	return {
		events: [],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: syncedSave,
		}),
		save: syncedSave,
	} satisfies GameEngineResult;
});
