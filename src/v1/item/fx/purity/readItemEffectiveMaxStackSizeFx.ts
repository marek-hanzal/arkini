import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
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
