import { Effect } from "effect";

import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { fromStateItemFx } from "./fromStateItemFx";

export namespace fromStateFx {
	export interface Props {
		state: StateSchema.Type;
	}
}

/**
 * Builds the core runtime from serializable state and canonical game items.
 *
 * Counterpart: `fromRuntimeFx` in `~/v1/state/fx/fromRuntimeFx` builds
 * serializable state from this runtime.
 */
export const fromStateFx = Effect.fn("fromStateFx")(function* ({ state }: fromStateFx.Props) {
	const items = yield* Effect.forEach(state.items, (state) => {
		return fromStateItemFx({
			state,
		});
	});

	return yield* assertRuntimeFx({
		runtime: {
			items,
		} satisfies RuntimeSchema.Type,
	});
});
