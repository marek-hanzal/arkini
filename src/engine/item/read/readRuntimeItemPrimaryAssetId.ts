import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Resolves the authored primary visual selected by the current runtime root state. */
export const readRuntimeItemPrimaryAssetId = (
	runtime: RuntimeSchema.Type,
	item: RuntimeItemSchema.Type["item"],
) => {
	if (item.type === "cheat:speed") {
		return item.asset.source[runtime.session.speedMode === "accelerated" ? 0 : 1];
	}
	return item.asset.source[0];
};
