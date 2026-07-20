import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readRuntimeItemPrimaryAssetId } from "~/engine/item/read/readRuntimeItemPrimaryAssetId";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileIdentity {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly categoryId: IdSchema.Type;
				readonly sourceResourceId: IdSchema.Type;
				readonly compositeResourceId?: IdSchema.Type;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readTileIdentity.Result;

/** Projects the shared authored identity rendered by every tile workspace shell. */
export const readTileIdentity = ({
	itemId,
	runtime,
}: readTileIdentity.Props): readTileIdentity.Result => {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return unavailable;
	return {
		kind: "available",
		itemId: item.id,
		title: item.item.title,
		categoryId: item.item.categoryId,
		sourceResourceId: readRuntimeItemPrimaryAssetId(runtime, item.item),
		...(item.item.asset.composite === undefined
			? {}
			: {
					compositeResourceId: item.item.asset.composite,
				}),
	};
};
