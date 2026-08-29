import { Effect } from "effect";

import { resolveJobRunnableFx } from "~/production-job/fx/resolveJobRunnableFx";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveActiveJobStatusFx {
	export interface Props {
		readonly job: JobSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Classifies one active job from canonical remaining-time and live-rule truth. */
export const resolveActiveJobStatusFx = Effect.fn("resolveActiveJobStatusFx")(function* ({
	job,
	runtime,
}: resolveActiveJobStatusFx.Props) {
	const runnable = yield* resolveJobRunnableFx({
		job,
		runtime,
	});
	if (!runnable) return JobStatusEnumSchema.enum.Paused;
	return job.remainingMs === 0
		? JobStatusEnumSchema.enum.AwaitingOutput
		: JobStatusEnumSchema.enum.Running;
});
