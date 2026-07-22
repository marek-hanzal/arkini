import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

export namespace readRuntimeItemPrimaryAssetIdFx {
	export interface Props {
		readonly item: RuntimeItemSchema.Type["item"];
	}
}

/** Resolves the authored primary visual for one canonical runtime item. */
export const readRuntimeItemPrimaryAssetIdFx = Effect.fn("readRuntimeItemPrimaryAssetIdFx")(
	function* ({ item }: readRuntimeItemPrimaryAssetIdFx.Props) {
		return item.asset.source[0];
	},
);
