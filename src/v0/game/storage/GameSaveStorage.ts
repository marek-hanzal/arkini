import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const activeGameSaveId = "default";
export const gameSaveStorageSchemaVersion = 1;

export interface GameSaveStorageScope {
	configHash: string;
	gameId: string;
	saveId?: string;
}

export interface SaveActiveGameSaveProps {
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
