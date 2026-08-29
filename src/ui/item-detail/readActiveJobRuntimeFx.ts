import { Effect } from "effect";
import { match } from "ts-pattern";

import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { ItemRuntimeValue } from "~/ui/item-detail/ItemRuntime";
import { formatItemDurationFx } from "~/ui/item-detail/formatItemDurationFx";

export namespace readActiveJobRuntimeFx {
	export interface Props {
		readonly durationMs: number;
		readonly remainingMs: number;
		readonly status: JobStatusEnumSchema.Type;
	}
}

/** Projects one active job into the shared runtime presentation. */
export const readActiveJobRuntimeFx = Effect.fn("readActiveJobRuntimeFx")(
	(job: readActiveJobRuntimeFx.Props) =>
		Effect.gen(function* () {
			const remaining = yield* formatItemDurationFx(job.remainingMs);
			const duration = yield* formatItemDurationFx(job.durationMs);
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
				.exhaustive() satisfies ItemRuntimeValue;
		}),
);
