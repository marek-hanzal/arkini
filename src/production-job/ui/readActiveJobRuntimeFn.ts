import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import { formatDurationFn } from "~/ui/formatDurationFn";

interface ActiveJobRuntime {
	readonly durationMs: number;
	readonly remainingMs: number;
	readonly status: JobStatusEnumSchema.Type;
}

/** Projects one active job into the shared runtime presentation. */
export const readActiveJobRuntimeFn = (job: ActiveJobRuntime) => {
	const remaining = formatDurationFn(job.remainingMs);
	const duration = formatDurationFn(job.durationMs);
	return match(job.status)
		.with(JobStatusEnumSchema.enum.Running, () => ({
			value: remaining,
			detail: `Remaining of ${duration}`,
		}))
		.with(JobStatusEnumSchema.enum.Paused, () => ({
			value: remaining,
			detail: `Paused · of ${duration}`,
		}))
		.with(JobStatusEnumSchema.enum.AwaitingOutput, () => ({
			value: "Complete",
			detail: "Awaiting output",
		}))
		.exhaustive();
};
