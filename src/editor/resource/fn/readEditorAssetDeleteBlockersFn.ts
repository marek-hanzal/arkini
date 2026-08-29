import type { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { readGameResourceUsagesFn } from "~/game-config/resource/fn/readGameResourceUsagesFn";

export type EditorAssetDeleteBlocker = readGameResourceUsagesFn.Usage;

export namespace readEditorAssetDeleteBlockersFn {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly resourceId: string;
	}
}

/** Finds canonical config references that require one asset to remain available. */
export const readEditorAssetDeleteBlockersFn = ({
	config,
	resourceId,
}: readEditorAssetDeleteBlockersFn.Props) =>
	readGameResourceUsagesFn(config).filter((usage) => usage.resourceId === resourceId);
