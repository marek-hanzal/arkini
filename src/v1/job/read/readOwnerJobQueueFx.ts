import { Clock, Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveOwnerJobQueueFx } from "~/v1/job/fx/read/resolveOwnerJobQueueFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";

export namespace readOwnerJobQueueFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
	}
}

/** Reads one owner's current declarative job queue without mutating runtime. */
export const readOwnerJobQueueFx = Effect.fn("readOwnerJobQueueFx")(function* ({
	ownerItemId,
}: readOwnerJobQueueFx.Props) {
	const runtime = yield* readRuntimeFx();
	const nowMs = yield* Clock.currentTimeMillis;
	return yield* resolveOwnerJobQueueFx({
		jobs: runtime.jobs,
		ownerItemId,
		nowMs,
	});
});
