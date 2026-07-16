import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { JobSchema } from "~/engine/job/schema/JobSchema";

export namespace filterOwnerJobsFx {
	export interface Props {
		jobs: JobSchema.Type[];
		ownerItemId: IdSchema.Type;
	}
}

/** Filters active jobs to the queue owned by one runtime item. */
export const filterOwnerJobsFx = Effect.fn("filterOwnerJobsFx")(function* ({
	jobs,
	ownerItemId,
}: filterOwnerJobsFx.Props) {
	return jobs.filter((job) => job.ownerItemId === ownerItemId) satisfies JobSchema.Type[];
});
