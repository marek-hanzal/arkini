import type { Effect } from "effect";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

import type { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";

/** One loaded game instance exclusively owned by its package route resource. */
export interface Game extends PlayableGame {
	readonly manualSaveFx: Effect.Effect<void, unknown>;
	readonly listSavesFx: Effect.Effect<readonly GameSaveStorage.Slot[], unknown>;
	/** Validates and pins the selected bytes before any live session is discarded. */
	readonly prepareRestoreFx: (
		slot: GameSaveSlotSchema.Type,
	) => Effect.Effect<Effect.Effect<void, unknown>, unknown>;
	/** Exact package identity and launcher metadata for this live game. */
	readonly serapack: SerapackDescriptor;
	/** Stable filesystem save identity owned by this live game. */
	readonly saveKey: GameSaveStorage.Key;
	/** Pending first-game welcome; stays acknowledged across scene remounts in this session. */
	readonly introduction?: {
		readonly readFn: () => string | undefined;
		readonly continueFx: Effect.Effect<void, unknown, never>;
	};
}

/** Installed-package resource used by routes and durable lifecycle operations. */
export type InstalledGameEngineResource = GameEngineResource<Game>;

/** Installed-package capability exposed to mounted Game presentation. */
export type PackageGameEngine = GameEngine<Game>;
