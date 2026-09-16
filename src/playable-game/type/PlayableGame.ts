import type { GameSession } from "~/game-session/type/GameSession";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export interface PlayableResource {
	readonly id: string;
	readonly type: ResourceTypeSchema.Type;
}

/** Package-independent live game consumed by shared gameplay presentation. */
export interface PlayableGame extends GameSession {
	/** Correlates renderer command diagnostics when this session installs them. */
	readonly diagnosticSessionId?: string;
	/** Immutable completed configuration owned by this exact session. */
	readonly config: GameConfigSchema.Type;
	/** Immutable semantic catalog available to presentation runtimes. */
	readonly resources: ReadonlyArray<PlayableResource>;
	/** Resolves one validated session resource to its renderer object URL. */
	readonly getResourceUrlFn: (resourceId: string) => string;
}
