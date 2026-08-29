import type { ArkpackDescriptor } from "~/arkpack/ArkpackDescriptor";
import type { PlayableGame } from "~/renderer/game/PlayableGame";
import type { GameSaveStorage } from "~/game-persistence/GameSaveStorage";

/** One loaded game instance exclusively owned by its package route resource. */
export interface Game extends PlayableGame {
	/** Exact package identity and launcher metadata for this live game. */
	readonly arkpack: ArkpackDescriptor;
	/** Stable filesystem save identity owned by this live game. */
	readonly saveKey: GameSaveStorage.Key;
}
