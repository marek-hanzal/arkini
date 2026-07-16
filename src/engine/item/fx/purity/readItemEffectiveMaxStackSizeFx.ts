import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { isItemPureFx } from "./isItemPureFx";

export namespace readItemEffectiveMaxStackSizeFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Resolves the stack limit allowed by one live item's current runtime state. */
export const readItemEffectiveMaxStackSizeFx = Effect.fn("readItemEffectiveMaxStackSizeFx")(
	function* ({ item, runtime }: readItemEffectiveMaxStackSizeFx.Props) {
		const pure = yield* isItemPureFx({
			item,
			runtime,
		});

		return (pure ? item.item.maxStackSize : 1) satisfies PositiveIntegerSchema.Type;
	},
);
