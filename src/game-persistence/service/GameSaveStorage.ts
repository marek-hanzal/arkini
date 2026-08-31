import type { Effect } from "effect";

export namespace GameSaveStorage {
	export interface Key {
		readonly packageId: string;
	}
}

/** Effect-native renderer capability for opaque save-byte persistence. */
export interface GameSaveStorage {
	readonly readFx: (key: GameSaveStorage.Key) => Effect.Effect<Uint8Array | null, unknown, never>;
	readonly clearFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown, never>;
	readonly writeFx: (
		key: GameSaveStorage.Key,
		bytes: Uint8Array,
	) => Effect.Effect<void, unknown, never>;
}
