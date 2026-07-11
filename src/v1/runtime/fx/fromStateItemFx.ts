import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { BaseRuntimeItemSchema } from "~/v1/runtime/schema/BaseRuntimeItemSchema";
import type { BaseStateItemSchema } from "~/v1/state/schema/BaseStateItemSchema";

export namespace fromStateItemFx {
	export interface Props {
		state: BaseStateItemSchema.Type;
	}
}

/**
 * Builds one runtime grid item from its persisted state representation.
 *
 * Counterpart: `fromRuntimeItemFx` in `~/v1/state/fx/fromRuntimeItemFx`
 * builds state from this runtime item.
 */
export const fromStateItemFx = Effect.fn("fromStateItemFx")(function* ({
	state,
}: fromStateItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: state.itemId,
	});
	const result = {
		id: state.id,
		item,
		quantity: state.quantity,
	};

	return result satisfies BaseRuntimeItemSchema.Type;
});
