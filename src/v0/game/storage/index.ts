export {
	activeGameSaveId,
	gameSaveStorageSchemaVersion,
} from "~/v0/game/storage/GameSaveStorage";
export type {
	CloseableGameSaveStorage,
	DeleteActiveGameSaveProps,
	GameSaveStorage,
	GameSaveStorageRecord,
	GameSaveStorageScope,
	SaveActiveGameSaveProps,
} from "~/v0/game/storage/GameSaveStorage";
export {
	createDefaultDexieGameSaveStorage,
	DexieGameSaveStorage,
	wipeDefaultDexieGameSaveStorage,
} from "~/v0/game/storage/DexieGameSaveStorage";
export { hashRuntimeGameConfig } from "~/v0/game/storage/hashRuntimeGameConfig";
