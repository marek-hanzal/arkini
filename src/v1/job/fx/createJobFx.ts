import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { TimestampSchema } from "~/v1/common/schema/TimestampSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { createRevisionFx } from "~/v1/revision/fx/createRevisionFx";
import { createJobIdFx } from "./createJobIdFx";

export namespace createJobFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		startedAtMs: TimestampSchema.Type;
		dueAtMs: TimestampSchema.Type;
	}
}

/** Creates one active product-line job with a fresh identity and revision. */
export const createJobFx = Effect.fn("createJobFx")(function* ({
	ownerItemId,
	lineId,
	startedAtMs,
	dueAtMs,
}: createJobFx.Props) {
	return {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineId,
		startedAtMs,
		dueAtMs,
		revision: yield* createRevisionFx(),
	} satisfies JobSchema.Type;
});
