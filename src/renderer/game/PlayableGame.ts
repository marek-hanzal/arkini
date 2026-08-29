import type { GameSession } from "~/renderer/game/session/GameSession";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";

/** Package-independent live game consumed by shared gameplay presentation. */
export interface PlayableGame extends GameSession {
	/** Correlates renderer command diagnostics when this session installs them. */
	readonly diagnosticSessionId?: string;
	/** Immutable completed configuration owned by this exact session. */
	readonly config: GameConfigSchema.Type;
	/** Resolves one validated session resource to its renderer object URL. */
	readonly getResourceUrl: (resourceId: string) => string;
}
