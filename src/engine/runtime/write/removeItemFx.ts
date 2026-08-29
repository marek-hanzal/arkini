import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { removeItemRuntimeTransitionFx } from "~/engine/runtime/fx/removeItemRuntimeTransitionFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";

export namespace removeItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		revision: RevisionSchema.Type;
	}
}

/**
 * Atomically removes one live item by its stable identity.
 */
export const removeItemFx = Effect.fn("removeItemFx")(function* ({
	itemId,
	revision,
}: removeItemFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const removal = yield* removeItemRuntimeTransitionFx({
				itemId,
				revision,
				runtime,
			});

			return [
				removal.item,
				removal.runtime,
				removal.events,
			] as const;
		});
	});
});
