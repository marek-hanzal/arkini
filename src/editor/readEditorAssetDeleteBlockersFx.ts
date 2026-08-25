import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readGameResourceUsagesFx } from "~/engine/resource/readGameResourceUsagesFx";

export type EditorAssetDeleteBlocker = readGameResourceUsagesFx.Usage;

export namespace readEditorAssetDeleteBlockersFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly resourceId: string;
	}
}

/** Finds canonical config references that require one asset to remain available. */
export const readEditorAssetDeleteBlockersFx = Effect.fn("readEditorAssetDeleteBlockersFx")(
	function* ({ config, resourceId }: readEditorAssetDeleteBlockersFx.Props) {
		const usages = yield* readGameResourceUsagesFx(config);
		return usages.filter((usage) => usage.resourceId === resourceId);
	},
);
