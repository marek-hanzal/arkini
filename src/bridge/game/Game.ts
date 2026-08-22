import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { PlayableGame } from "~/bridge/game/PlayableGame";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

/** One loaded game instance exclusively owned by its package route resource. */
export interface Game extends PlayableGame {
	/** Exact package identity and launcher metadata for this live game. */
	readonly arkpack: ArkpackDescriptor;
	/** Exact filesystem save identity owned by this live game. */
	readonly saveKey: GameSaveStorage.Key;
}
