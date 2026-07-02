export {
	activeGameSaveId,
	gameSaveStorageSchemaVersion,
} from "~/storage/GameSaveStorage";
export type {
	CloseableGameSaveStorage,
	DeleteActiveGameSaveProps,
	GameSaveStorage,
	GameSaveStorageRecord,
	GameSaveStorageScope,
	SaveActiveGameSaveProps,
} from "~/storage/GameSaveStorage";
export {
	createDefaultDexieGameSaveStorage,
	DexieGameSaveStorage,
	wipeDefaultDexieGameSaveStorage,
} from "~/storage/DexieGameSaveStorage";
export { hashRuntimeGameConfig } from "~/storage/hashRuntimeGameConfig";
