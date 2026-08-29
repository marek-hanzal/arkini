import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import type { ItemRuntimeValue } from "~/ui/item-detail/ItemRuntime";
import { formatItemDurationFn } from "~/ui/item-detail/fn/formatItemDurationFn";

export namespace readActiveJobRuntimeFn {
	export interface Props {
		readonly durationMs: number;
		readonly remainingMs: number;
		readonly status: JobStatusEnumSchema.Type;
	}
}

/** Projects one active job into the shared runtime presentation. */
export const readActiveJobRuntimeFn = (job: readActiveJobRuntimeFn.Props): ItemRuntimeValue => {
	const remaining = formatItemDurationFn(job.remainingMs);
	const duration = formatItemDurationFn(job.durationMs);
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
