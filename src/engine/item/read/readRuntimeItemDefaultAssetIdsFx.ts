import { Effect } from "effect";

import type { AssetSchema } from "~/engine/item/schema/AssetSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

export namespace readRuntimeItemDefaultAssetIdsFx {
	export interface Props {
		readonly item: RuntimeItemSchema.Type["item"];
	}
}

/** Resolves the complete authored default visual for one canonical runtime item. */
export const readRuntimeItemDefaultAssetIdsFx = Effect.fn("readRuntimeItemDefaultAssetIdsFx")(
	function* ({ item }: readRuntimeItemDefaultAssetIdsFx.Props) {
		return item.asset.default satisfies AssetSchema.Type["default"];
	},
);
