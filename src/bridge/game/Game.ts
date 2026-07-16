import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { GameSession } from "~/bridge/game/GameSession";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** One loaded game instance exclusively owned by the stable root game owner. */
export interface Game extends GameSession {
	/** Exact package identity and launcher metadata for this live game. */
	readonly arkpack: ArkpackDescriptor;
	/** Exact filesystem save identity owned by this live game. */
	readonly saveKey: GameSaveStorage.Key;
	/** React remount key replaced together with the complete game instance. */
	readonly instanceKey: string;
	/** Immutable completed configuration used by this loaded game. */
	readonly config: GameConfigSchema.Type;
	/** Resolves one validated embedded resource to its browser object URL. */
	readonly getResourceUrl: (resourceId: string) => string;
}
