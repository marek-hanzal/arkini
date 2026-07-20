import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readRuntimeItemPrimaryAssetId } from "~/engine/item/read/readRuntimeItemPrimaryAssetId";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileInfo {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly categoryId: string;
				readonly description: string;
				readonly sourceResourceId: string;
				readonly compositeResourceId?: string;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readTileInfo.Result;

/** Projects the canonical authored facts needed by the Info capability. */
export const readTileInfo = ({ itemId, runtime }: readTileInfo.Props): readTileInfo.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	return {
		kind: "available",
		itemId: item.id,
		title: item.item.title,
		categoryId: item.item.categoryId,
		description: item.item.description,
		sourceResourceId: readRuntimeItemPrimaryAssetId(runtime, item.item),
		...(item.item.asset.composite === undefined
			? {}
			: {
					compositeResourceId: item.item.asset.composite,
				}),
	};
};
