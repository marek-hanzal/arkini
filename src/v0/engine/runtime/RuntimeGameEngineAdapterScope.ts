import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { RandomService } from "~/random/context/RandomService";
import type { GameEngineRuntimeUpdate } from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export interface RuntimeGameEngineAdapterScope {
	readonly config: GameConfig;
	readonly random?: RandomService;
	publish(update: GameEngineRuntimeUpdate): void;
	readNextWakeAtMs(): number | null;
	readSave(): GameSave;
	storeResult(result: GameEngineResult): void;
}
