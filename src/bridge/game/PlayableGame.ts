import type { GameSession } from "~/bridge/game/GameSession";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Package-independent live game consumed by shared gameplay presentation. */
export interface PlayableGame extends GameSession {
	/** Correlates renderer command diagnostics when this session installs them. */
	readonly diagnosticSessionId?: string;
	/** Immutable completed configuration owned by this exact session. */
	readonly config: GameConfigSchema.Type;
	/** Resolves one validated session resource to its renderer object URL. */
	readonly getResourceUrl: (resourceId: string) => string;
}
