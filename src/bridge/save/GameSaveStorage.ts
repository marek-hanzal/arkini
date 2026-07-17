import type { Effect } from "effect";

export namespace GameSaveStorage {
	export interface Key {
		readonly packageId: string;
		readonly contentHash: string;
	}
}

/** Effect-native renderer capability for opaque save-byte persistence. */
export interface GameSaveStorage {
	readonly readFx: (key: GameSaveStorage.Key) => Effect.Effect<Uint8Array | null, unknown>;
	readonly clearFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown>;
	readonly writeFx: (key: GameSaveStorage.Key, bytes: Uint8Array) => Effect.Effect<void, unknown>;
}
