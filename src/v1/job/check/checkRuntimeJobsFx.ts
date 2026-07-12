import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { DuplicateJobIdIssueSchema } from "~/v1/job/schema/DuplicateJobIdIssueSchema";
import type { JobLineMissingIssueSchema } from "~/v1/job/schema/JobLineMissingIssueSchema";
import type { JobOwnerMissingIssueSchema } from "~/v1/job/schema/JobOwnerMissingIssueSchema";
import type { JobOwnerNotOnGridIssueSchema } from "~/v1/job/schema/JobOwnerNotOnGridIssueSchema";
import type { JobQueueExceededIssueSchema } from "~/v1/job/schema/JobQueueExceededIssueSchema";
import type { JobReservationMissingIssueSchema } from "~/v1/job/schema/JobReservationMissingIssueSchema";
import type { JobTimeInvalidIssueSchema } from "~/v1/job/schema/JobTimeInvalidIssueSchema";
import { readItemQueueSizeFx } from "~/v1/job/read/readItemQueueSizeFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { isJobRuntimeItem } from "~/v1/runtime/read/isJobRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace checkRuntimeJobsFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reports invalid active jobs, queued start requests, and job reservations. */
export const checkRuntimeJobsFx = Effect.fn("checkRuntimeJobsFx")(function* ({
	runtime,
}: checkRuntimeJobsFx.Props) {
	const duplicateIssues: DuplicateJobIdIssueSchema.Type[] = [];
	const ownerIssues: JobOwnerMissingIssueSchema.Type[] = [];
	const lineIssues: JobLineMissingIssueSchema.Type[] = [];
	const ownerGridIssues: JobOwnerNotOnGridIssueSchema.Type[] = [];
	const queueIssues: JobQueueExceededIssueSchema.Type[] = [];
	const timeIssues: JobTimeInvalidIssueSchema.Type[] = [];
	const reservationMissingIssues: JobReservationMissingIssueSchema.Type[] = [];
	const queue = runtime.jobQueue ?? [];
	const entries = [
		...runtime.jobs,
		...queue,
	];
	const seenIds = new Set<IdSchema.Type>();

	for (const entry of entries) {
		if (seenIds.has(entry.id))
			duplicateIssues.push({
				jobId: entry.id,
				type: "job:id:duplicate",
			});
		else seenIds.add(entry.id);

		const job = runtime.jobs.find((candidate) => candidate.id === entry.id);
		if (job !== undefined && job.remainingMs > job.durationMs) {
			timeIssues.push({
				jobId: job.id,
				durationMs: job.durationMs,
				remainingMs: job.remainingMs,
				type: "job:time-invalid",
			});
		}
		const owner = runtime.items.find((item) => item.id === entry.ownerItemId);
		if (owner === undefined) {
			ownerIssues.push({
				jobId: entry.id,
				ownerItemId: entry.ownerItemId,
				type: "job:owner-missing",
			});
			continue;
		}
		if (!isGridRuntimeItem(owner))
			ownerGridIssues.push({
				jobId: entry.id,
				ownerItemId: owner.id,
				location: owner.location,
				type: "job:owner-not-on-grid",
			});
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: entry.lineId,
		});
		if (line === undefined)
			lineIssues.push({
				jobId: entry.id,
				ownerItemId: entry.ownerItemId,
				lineId: entry.lineId,
				type: "job:line-missing",
			});
	}

	for (const ownerItemId of new Set(entries.map((entry) => entry.ownerItemId))) {
		const owner = runtime.items.find((item) => item.id === ownerItemId);
		if (owner === undefined) continue;
		const maxQueueSize = yield* readItemQueueSizeFx({
			item: owner.item,
		});
		if (maxQueueSize === undefined) continue;
		const ids = entries
			.filter((entry) => entry.ownerItemId === ownerItemId)
			.map((entry) => entry.id);
		if (ids.length > maxQueueSize)
			queueIssues.push({
				ownerItemId,
				jobIds: ids,
				maxQueueSize,
				queueSize: ids.length,
				type: "job:queue-exceeded",
			});
	}

	for (const item of runtime.items.filter(isJobRuntimeItem)) {
		if (!runtime.jobs.some((job) => job.id === item.location.jobId)) {
			reservationMissingIssues.push({
				itemId: item.id,
				jobId: item.location.jobId,
				location: item.location,
				type: "job:reservation-missing",
			});
		}
	}

	return [
		...duplicateIssues,
		...ownerIssues,
		...ownerGridIssues,
		...lineIssues,
		...queueIssues,
		...timeIssues,
		...reservationMissingIssues,
	];
});
