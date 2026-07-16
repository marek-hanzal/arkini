import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { GameSession } from "~/bridge/game/GameSession";

/** One loaded game instance owned by the `/game` shell. */
export interface Game extends GameSession {
	/** React remount key replaced together with the complete game instance. */
	readonly instanceKey: string;
	/** Immutable completed configuration used by this loaded game. */
	readonly config: GameConfigSchema.Type;
	/** Resolves one validated embedded resource to its browser object URL. */
	readonly getResourceUrl: (resourceId: string) => string;
}
