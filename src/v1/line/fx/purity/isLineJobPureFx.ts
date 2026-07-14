import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace isLineJobPureFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one live line owns no active job. */
export const isLineJobPureFx = Effect.fn("isLineJobPureFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: isLineJobPureFx.Props) {
	return !runtime.jobs.some((job) => {
		return job.ownerItemId === ownerItemId && job.lineId === lineId;
	});
});
