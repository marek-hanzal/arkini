import type { Effect } from "effect";
import type { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";

export namespace GameSaveStorage {
	export interface Key {
		readonly packageId: string;
	}
	export interface Slot {
		readonly slot: GameSaveSlotSchema.Type;
		readonly savedAt: number | null;
	}
}

/** Effect-native renderer capability for opaque save-byte persistence. */
export interface GameSaveStorage {
	readonly readFx: (
		key: GameSaveStorage.Key,
		slot?: GameSaveSlotSchema.Type,
	) => Effect.Effect<Uint8Array | null, unknown, never>;
	readonly clearFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown, never>;
	readonly writeFx: (
		key: GameSaveStorage.Key,
		bytes: Uint8Array,
		slot?: "current" | "manual",
	) => Effect.Effect<void, unknown, never>;
	readonly listFx: (
		key: GameSaveStorage.Key,
	) => Effect.Effect<readonly GameSaveStorage.Slot[], unknown, never>;
	readonly restoreFx: (
		key: GameSaveStorage.Key,
		bytes: Uint8Array,
	) => Effect.Effect<void, unknown, never>;
}
