import type { ArkpackDescriptor } from "~/arkpack/type/ArkpackDescriptor";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

/** One loaded game instance exclusively owned by its package route resource. */
export interface Game extends PlayableGame {
	/** Exact package identity and launcher metadata for this live game. */
	readonly arkpack: ArkpackDescriptor;
	/** Stable filesystem save identity owned by this live game. */
	readonly saveKey: GameSaveStorage.Key;
}

/** Installed-package resource used by routes and durable lifecycle operations. */
export type InstalledGameEngineResource = GameEngineResource<Game>;

/** Installed-package capability exposed to mounted Game presentation. */
export type PackageGameEngine = GameEngine<Game>;
