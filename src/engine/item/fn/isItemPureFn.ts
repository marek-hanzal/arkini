import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isItemPureWithIndexFn } from "./isItemPureWithIndexFn";
import { readItemPurityIndexFn } from "./readItemPurityIndexFn";

export namespace isItemPureFn {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live item owns no identity-bound runtime state. */
export const isItemPureFn = ({ item, runtime }: isItemPureFn.Props) => {
	const index = readItemPurityIndexFn(runtime);
	return isItemPureWithIndexFn({
		index,
		item,
		runtime,
	});
};
