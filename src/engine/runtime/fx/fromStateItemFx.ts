import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { createRevisionFx } from "~/engine/revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { StateItemSchema } from "~/engine/state/schema/StateItemSchema";

export namespace fromStateItemFx {
	export interface Props {
		state: StateItemSchema.Type;
	}
}

/**
 * Builds one runtime item from persisted gameplay state with a fresh session revision.
 *
 * Counterpart: `fromRuntimeItemFx` in `~/engine/state/fx/fromRuntimeItemFx`
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
