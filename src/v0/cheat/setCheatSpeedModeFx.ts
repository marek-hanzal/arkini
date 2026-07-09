import { Effect } from "effect";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { isCheatSpeedItemId, readCheatSpeedItemIdFromMode } from "~/cheat/GameCheatSpeedItem";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import { syncRealtimeWorldJobsFx } from "~/world/syncRealtimeWorldJobsFx";
import type { GameActionCheatSpeedModeSetSchema } from "~/action/GameActionCheatSpeedModeSetSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace setCheatSpeedModeFx {
	export interface Props {
		action: GameActionCheatSpeedModeSetSchema.Type;
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
	const previousMode = readGameCheatSpeedMode({
		save,
	});
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

	return yield* createGameEngineResultFx({
		config,
		events:
			previousMode === action.mode
				? []
				: [
						{
							atMs: nowMs,
							nextMode: action.mode,
							previousMode,
							type: "cheat.speed_mode.changed" as const,
						},
					],
		nowMs,
		save: syncedSave,
	});
});
