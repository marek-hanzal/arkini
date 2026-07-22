import { Effect } from "effect";

import { ItemJobScopedError } from "~/engine/runtime/error/ItemJobScopedError";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace assertNonJobScopeFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
	}
}

/** Rejects generic mutations of consumed or reserved materials owned by an active job. */
export const assertNonJobScopeFx = Effect.fn("assertNonJobScopeFx")(function* ({
	item,
}: assertNonJobScopeFx.Props) {
	if (item.location.scope !== LocationScopeEnumSchema.enum.Job && item.location.scope !== LocationScopeEnumSchema.enum.Reserved) return;

	return yield* Effect.fail(
		new ItemJobScopedError({
			itemId: item.id,
			jobId: item.location.jobId,
		}),
	);
});
