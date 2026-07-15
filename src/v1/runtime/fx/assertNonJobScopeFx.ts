import { Effect } from "effect";

import { ItemJobScopedError } from "~/v1/runtime/error/ItemJobScopedError";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace assertNonJobScopeFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
	}
}

/** Rejects generic mutations of consumed or reserved materials owned by an active job. */
export const assertNonJobScopeFx = Effect.fn("assertNonJobScopeFx")(function* ({
	item,
}: assertNonJobScopeFx.Props) {
	if (item.location.scope !== "job" && item.location.scope !== "reserved") return;

	return yield* Effect.fail(
		new ItemJobScopedError({
			itemId: item.id,
			jobId: item.location.jobId,
		}),
	);
});
