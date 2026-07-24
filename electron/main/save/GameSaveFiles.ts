import type { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";

/** Effect-native main-process capability for exact package/hash save persistence. */
export interface GameSaveFiles {
	readonly readFx: (key: ArkiniElectronApi.SaveKey) => Effect.Effect<Uint8Array | null, unknown>;
	readonly writeFx: (
		key: ArkiniElectronApi.SaveKey,
		bytes: Uint8Array,
	) => Effect.Effect<void, unknown>;
	readonly clearFx: (key: ArkiniElectronApi.SaveKey) => Effect.Effect<void, unknown>;
}
