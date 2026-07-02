import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export const activeGameSaveId = "default";
export const gameSaveStorageSchemaVersion = 1;

export interface GameSaveStorageScope {
	config: GameConfig;
	configHash: string;
	saveId?: string;
}

export interface SaveActiveGameSaveProps {
	config: GameConfig;
	configHash: string;
	save: GameSave;
	saveId?: string;
}

export interface DeleteActiveGameSaveProps {
	saveId?: string;
}

export interface GameSaveStorageRecord {
	id: string;
	configHash: string;
	gameId: string;
	save: unknown;
	saveVersion: number;
	schemaVersion: typeof gameSaveStorageSchemaVersion;
	updatedAtMs: number;
}

export interface GameSaveStorage {
	deleteActiveSave(props?: DeleteActiveGameSaveProps): Promise<void>;
	loadActiveSave(props: GameSaveStorageScope): Promise<GameSave | null>;
	saveActiveSave(props: SaveActiveGameSaveProps): Promise<void>;
	wipe(): Promise<void>;
}

export interface CloseableGameSaveStorage extends GameSaveStorage {
	close(): void;
}
