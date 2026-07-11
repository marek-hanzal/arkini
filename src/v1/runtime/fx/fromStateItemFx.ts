import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";
import type { StateItemSchema } from "~/v1/state/schema/StateItemSchema";

export namespace fromStateItemFx {
	export interface Props {
		scope: Exclude<ScopeEnumSchema.Type, "any">;
		state: StateItemSchema.Type;
	}
}

/**
 * Builds one runtime grid item from its persisted state representation.
 *
 * Counterpart: `fromRuntimeItemFx` in `~/v1/state/fx/fromRuntimeItemFx`
 * builds state from this runtime item.
 */
export const fromStateItemFx = Effect.fn("fromStateItemFx")(function* ({
	scope,
	state,
}: fromStateItemFx.Props) {
	const item = yield* resolveItemFx({
		itemId: state.itemId,
	});
	const result = {
		id: state.id,
		item,
		quantity: state.quantity,
		scope,
		x: state.x,
		y: state.y,
	};

	return result satisfies RuntimeItemSchema.Type;
});
