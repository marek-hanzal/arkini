import type { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import type { ElectronMainError } from "../ElectronMainError";

/** Effect-native main-process capability for exact package/hash save persistence. */
export interface GameSaveFiles {
	readonly readFx: (
		key: ArkiniElectronApi.SaveKey,
	) => Effect.Effect<Uint8Array | null, ElectronMainError>;
	readonly writeFx: (
		key: ArkiniElectronApi.SaveKey,
		bytes: Uint8Array,
	) => Effect.Effect<void, ElectronMainError>;
	readonly clearFx: (key: ArkiniElectronApi.SaveKey) => Effect.Effect<void, ElectronMainError>;
}
