import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { GameSession } from "~/bridge/game/GameSession";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** One loaded game instance owned by the selected `/game/$packageId` shell. */
export interface Game extends GameSession {
	/** Exact package identity and launcher metadata for this live game. */
	readonly arkpack: ArkpackDescriptor;
	/** React remount key replaced together with the complete game instance. */
	readonly instanceKey: string;
	/** Immutable completed configuration used by this loaded game. */
	readonly config: GameConfigSchema.Type;
	/** Resolves one validated embedded resource to its browser object URL. */
	readonly getResourceUrl: (resourceId: string) => string;
}
