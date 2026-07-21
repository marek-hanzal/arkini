import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Resolves the authored primary visual for one canonical runtime item. */
export const readRuntimeItemPrimaryAssetId = (
	_runtime: RuntimeSchema.Type,
	item: RuntimeItemSchema.Type["item"],
) => item.asset.source[0];
