import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";

export type EditorAssetDeleteBlocker = readGameResourceUsagesFn.Usage;

interface ReadEditorAssetDeleteBlockersProps {
	readonly config: GameConfigSchema.Type;
	readonly resourceId: string;
}

/** Finds canonical config references that require one asset to remain available. */
export const readEditorAssetDeleteBlockersFn = ({
	config,
	resourceId,
}: ReadEditorAssetDeleteBlockersProps) =>
	readGameResourceUsagesFn(config).filter((usage) => usage.resourceId === resourceId);
