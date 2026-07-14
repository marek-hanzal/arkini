import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace isLineQueuePureFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live line owns no queued start request. */
export const isLineQueuePureFx = Effect.fn("isLineQueuePureFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: isLineQueuePureFx.Props) {
	return !(runtime.jobQueue ?? []).some((request) => {
		return request.ownerItemId === ownerItemId && request.lineId === lineId;
	});
});
