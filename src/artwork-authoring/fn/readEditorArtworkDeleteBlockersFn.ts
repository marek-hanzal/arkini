import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";

interface ReadEditorArtworkDeleteBlockersProps {
	readonly config: GameConfigSchema.Type;
	readonly resourceId: string;
}

/** Finds canonical config references that require one artwork to remain available. */
export const readEditorArtworkDeleteBlockersFn = ({
	config,
	resourceId,
}: ReadEditorArtworkDeleteBlockersProps) =>
	readGameResourceUsagesFn(config).filter((usage) => usage.resourceId === resourceId);
