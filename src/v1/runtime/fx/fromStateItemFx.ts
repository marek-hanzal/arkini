import { Effect } from "effect";

import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import { createRevisionFx } from "~/v1/revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { StateItemSchema } from "~/v1/state/schema/StateItemSchema";

export namespace fromStateItemFx {
	export interface Props {
		state: StateItemSchema.Type;
	}
}

/**
 * Builds one runtime item from persisted gameplay state with a fresh session revision.
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

	return {
		id: state.id,
		item,
		location: state.location,
		quantity: state.quantity,
		remainingCharges: state.remainingCharges,
		remainingDurationMs:
			state.remainingDurationMs ?? (item.type === "temporary" ? item.durationMs : undefined),
		revision: yield* createRevisionFx(),
	} satisfies RuntimeItemSchema.Type;
});
