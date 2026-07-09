import type { GameAction } from "~/action/GameActionSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { RandomService } from "~/random/context/RandomService";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";

export interface GameEngineRuntimeUpdate {
	nowMs: number;
	result: GameEngineResult;
}

export type GameEngineRuntimeListener = (update: GameEngineRuntimeUpdate) => void;

export interface GameEngineRuntimeSnapshot {
	config: GameConfig;
	lastEvents: readonly GameEvent[];
	nextWakeAtMs: number | null;
	save: GameSave;
}

export interface RuntimeGameEngineAdapterOptions {
	config?: GameConfig;
	initialSave?: GameSave;
	nowMs?: number;
	random?: RandomService;
}

export interface RuntimeGameEngineAdapterRequiredOptions {
	config: GameConfig;
	initialSave: GameSave;
	nextWakeAtMs: number | null;
	random?: RandomService;
}

export interface RuntimeGameEngineDispatchProps {
	action: GameAction | unknown;
	nowMs?: number;
}

export interface RuntimeGameEngineReadinessProps {
	action: GameAction | unknown;
	nowMs?: number;
}

export interface RuntimeGameEngineReplaceSaveProps {
	events?: GameEvent[];
	nowMs?: number;
	save: GameSave;
}

export interface RuntimeGameEngineTickProps {
	nowMs?: number;
}

export interface RuntimeGameEngineValidateSnapshotProps {
	checks?: readonly WorldSnapshotCheckId[];
	nowMs?: number;
}
