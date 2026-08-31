import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { removeItemRuntimeTransitionFx } from "~/item-interaction/fx/removeItemRuntimeTransitionFx";

/** Commits canonical removal as setup for tests whose regression belongs elsewhere. */
export const removeRuntimeItemForTestFx = Effect.fn("removeRuntimeItemForTestFx")(function* ({
	itemId,
	revision,
}: {
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
}) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
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
		}),
	);
});
