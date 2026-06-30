import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { syncRealtimeWorldJobsFx } from "~/v0/game/world/syncRealtimeWorldJobsFx";
import type { GameActionCheatSpeedModeSet } from "~/v0/game/action/GameActionCheatSpeedModeSet";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
