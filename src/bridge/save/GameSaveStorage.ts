export namespace GameSaveStorage {
	export interface Key {
		readonly packageId: string;
		readonly contentHash: string;
	}
}

/** Opaque durable save-byte storage isolated from codecs and game semantics. */
export interface GameSaveStorage {
	readonly close: () => void;
	readonly read: (key: GameSaveStorage.Key) => Promise<Uint8Array | null>;
	readonly clear: (key: GameSaveStorage.Key) => Promise<void>;
	readonly write: (key: GameSaveStorage.Key, bytes: Uint8Array) => Promise<void>;
}
