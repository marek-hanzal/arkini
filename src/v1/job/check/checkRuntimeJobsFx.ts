import { Effect } from "effect";

import type { DuplicateJobIdIssueSchema } from "~/v1/job/schema/DuplicateJobIdIssueSchema";
import type { JobLineMissingIssueSchema } from "~/v1/job/schema/JobLineMissingIssueSchema";
import type { JobOwnerMissingIssueSchema } from "~/v1/job/schema/JobOwnerMissingIssueSchema";
import type { JobQueueExceededIssueSchema } from "~/v1/job/schema/JobQueueExceededIssueSchema";
import type { JobReservationMismatchIssueSchema } from "~/v1/job/schema/JobReservationMismatchIssueSchema";
import type { JobReservationMissingIssueSchema } from "~/v1/job/schema/JobReservationMissingIssueSchema";
import type { JobTimeInvalidIssueSchema } from "~/v1/job/schema/JobTimeInvalidIssueSchema";
import { readItemQueueSizeFx } from "~/v1/job/read/readItemQueueSizeFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { isJobRuntimeItem } from "~/v1/runtime/read/isJobRuntimeItem";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace checkRuntimeJobsFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reports every invalid active-job and job-reservation invariant. */
export const checkRuntimeJobsFx = Effect.fn("checkRuntimeJobsFx")(function* ({
	runtime,
}: checkRuntimeJobsFx.Props) {
	const duplicateIssues: DuplicateJobIdIssueSchema.Type[] = [];
	const ownerIssues: JobOwnerMissingIssueSchema.Type[] = [];
	const lineIssues: JobLineMissingIssueSchema.Type[] = [];
	const queueIssues: JobQueueExceededIssueSchema.Type[] = [];
	const timeIssues: JobTimeInvalidIssueSchema.Type[] = [];
	const reservationMissingIssues: JobReservationMissingIssueSchema.Type[] = [];
	const reservationMismatchIssues: JobReservationMismatchIssueSchema.Type[] = [];

	const seenJobIds = new Set<string>();
	for (const job of runtime.jobs) {
		if (seenJobIds.has(job.id)) {
			duplicateIssues.push({
				jobId: job.id,
				type: "job:id:duplicate",
			});
		} else {
			seenJobIds.add(job.id);
		}
		if (job.dueAtMs < job.startedAtMs) {
			timeIssues.push({
				jobId: job.id,
				startedAtMs: job.startedAtMs,
				dueAtMs: job.dueAtMs,
				type: "job:time-invalid",
			});
		}
		const owner = runtime.items.find((item) => item.id === job.ownerItemId);
		if (owner === undefined) {
			ownerIssues.push({
				jobId: job.id,
				ownerItemId: job.ownerItemId,
				type: "job:owner-missing",
			});
			continue;
		}
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: job.lineId,
		});
		if (line === undefined) {
			lineIssues.push({
				jobId: job.id,
				ownerItemId: job.ownerItemId,
				lineId: job.lineId,
				type: "job:line-missing",
			});
		}
	}

	const checkedOwners = new Set<string>();
	for (const job of runtime.jobs) {
		if (checkedOwners.has(job.ownerItemId)) continue;
		checkedOwners.add(job.ownerItemId);
		const owner = runtime.items.find((item) => item.id === job.ownerItemId);
		if (owner === undefined) continue;
		const maxQueueSize = yield* readItemQueueSizeFx({
			item: owner.item,
		});
		if (maxQueueSize === undefined) continue;
		const ownerJobs = runtime.jobs.filter((candidate) => candidate.ownerItemId === owner.id);
		if (ownerJobs.length > maxQueueSize) {
			queueIssues.push({
				ownerItemId: owner.id,
				jobIds: ownerJobs.map((candidate) => candidate.id),
				maxQueueSize,
				queueSize: ownerJobs.length,
				type: "job:queue-exceeded",
			});
		}
	}

	for (const item of runtime.items.filter(isJobRuntimeItem)) {
		const job = runtime.jobs.find((candidate) => candidate.id === item.location.jobId);
		if (job === undefined) {
			reservationMissingIssues.push({
				itemId: item.id,
				jobId: item.location.jobId,
				location: item.location,
				type: "job:reservation-missing",
			});
			continue;
		}
		if (
			item.location.returnLocation.ownerItemId !== job.ownerItemId ||
			item.location.returnLocation.lineId !== job.lineId
		) {
			reservationMismatchIssues.push({
				itemId: item.id,
				jobId: job.id,
				location: item.location,
				type: "job:reservation-mismatch",
			});
		}
	}

	return [
		...duplicateIssues,
		...ownerIssues,
		...lineIssues,
		...queueIssues,
		...timeIssues,
		...reservationMissingIssues,
		...reservationMismatchIssues,
	];
});
