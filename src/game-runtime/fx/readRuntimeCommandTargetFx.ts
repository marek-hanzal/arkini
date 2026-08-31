import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemJobScopedError } from "~/game-runtime/error/ItemJobScopedError";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/**
 * Reads one command target and validates its captured revision and mutable scope.
 * The existing trace label stays stable because Effect diagnostics are observable.
 */
export const readRuntimeCommandTargetFx = Effect.fn("readValidatedRuntimeItemFx")(function* ({
	itemId,
	revision,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	yield* assertRevisionFx({
		actualRevision: item.revision,
		entityId: item.id,
		expectedRevision: revision,
	});
	if (
		item.location.scope === LocationScopeEnumSchema.enum.Job ||
		item.location.scope === LocationScopeEnumSchema.enum.Reserved
	) {
		return yield* Effect.fail(
			new ItemJobScopedError({
				itemId: item.id,
				jobId: item.location.jobId,
			}),
		);
	}
	return item;
});
