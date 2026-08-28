import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isItemPureWithIndexFx } from "./isItemPureWithIndexFx";
import { readItemPurityIndexFx } from "./readItemPurityIndexFx";

export namespace isItemPureFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live item owns no identity-bound runtime state. */
export const isItemPureFx = Effect.fn("isItemPureFx")(function* ({
	item,
	runtime,
}: isItemPureFx.Props) {
	const index = yield* readItemPurityIndexFx(runtime);
	return yield* isItemPureWithIndexFx({
		index,
		item,
		runtime,
	});
});
