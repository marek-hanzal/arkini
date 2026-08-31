import { Option } from "effect";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/check/RuntimeCheckIssueEnumSchema";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { DuplicateJobIdIssueSchema } from "~/production-job/schema/DuplicateJobIdIssueSchema";
import type { JobLineMissingIssueSchema } from "~/production-job/schema/JobLineMissingIssueSchema";
import type { JobOwnerMissingIssueSchema } from "~/production-job/schema/JobOwnerMissingIssueSchema";
import type { JobOwnerMultipleActiveIssueSchema } from "~/production-job/schema/JobOwnerMultipleActiveIssueSchema";
import type { JobOwnerNotOnGridIssueSchema } from "~/production-job/schema/JobOwnerNotOnGridIssueSchema";
import type { JobQueueExceededIssueSchema } from "~/production-job/schema/JobQueueExceededIssueSchema";
import type { JobConsumedMaterialStateIssueSchema } from "~/production-job/schema/JobConsumedMaterialStateIssueSchema";
import type { JobMaterialOrphanIssueSchema } from "~/production-job/schema/JobMaterialOrphanIssueSchema";
import type { JobTimeInvalidIssueSchema } from "~/production-job/schema/JobTimeInvalidIssueSchema";
import { readItemQueueSizeFn } from "~/production-job/fn/readItemQueueSizeFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import { readRuntimeItemOwnedStateFn } from "~/game-runtime/read/fn/readRuntimeItemOwnedStateFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

export namespace checkRuntimeJobsFn {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reports invalid active jobs, queued start requests, and job-owned materials. */
export const checkRuntimeJobsFn = ({ runtime }: checkRuntimeJobsFn.Props) => {
	const duplicateIssues: DuplicateJobIdIssueSchema.Type[] = [];
	const ownerIssues: JobOwnerMissingIssueSchema.Type[] = [];
	const multipleActiveIssues: JobOwnerMultipleActiveIssueSchema.Type[] = [];
	const lineIssues: JobLineMissingIssueSchema.Type[] = [];
	const ownerGridIssues: JobOwnerNotOnGridIssueSchema.Type[] = [];
	const queueIssues: JobQueueExceededIssueSchema.Type[] = [];
	const timeIssues: JobTimeInvalidIssueSchema.Type[] = [];
	const materialOrphanIssues: JobMaterialOrphanIssueSchema.Type[] = [];
	const consumedStateIssues: JobConsumedMaterialStateIssueSchema.Type[] = [];
	const queue = runtime.jobQueue;
	const entries = [
		...runtime.jobs,
		...queue,
	];
	const seenIds = new Set<IdSchema.Type>();

	for (const entry of entries) {
		if (seenIds.has(entry.id))
			duplicateIssues.push({
				jobId: entry.id,
				type: RuntimeCheckIssueEnumSchema.enum.DuplicateJobId,
			});
		else seenIds.add(entry.id);

		const job = runtime.jobs.find((candidate) => candidate.id === entry.id);
		if (job !== undefined && job.remainingMs > job.durationMs) {
			timeIssues.push({
				jobId: job.id,
				durationMs: job.durationMs,
				remainingMs: job.remainingMs,
				type: RuntimeCheckIssueEnumSchema.enum.JobTimeInvalid,
			});
		}
		const owner = runtime.items.find((item) => item.id === entry.ownerItemId);
		if (owner === undefined) {
			ownerIssues.push({
				jobId: entry.id,
				ownerItemId: entry.ownerItemId,
				type: RuntimeCheckIssueEnumSchema.enum.JobOwnerMissing,
			});
			continue;
		}
		if (Option.isNone(isGridRuntimeItemFn(owner)))
			ownerGridIssues.push({
				jobId: entry.id,
				ownerItemId: owner.id,
				location: owner.location,
				type: RuntimeCheckIssueEnumSchema.enum.JobOwnerNotOnGrid,
			});
		const line = readItemLineFn({
			item: owner.item,
			lineId: entry.lineId,
		});
		if (line === undefined)
			lineIssues.push({
				jobId: entry.id,
				ownerItemId: entry.ownerItemId,
				lineId: entry.lineId,
				type: RuntimeCheckIssueEnumSchema.enum.JobLineMissing,
			});
	}

	for (const ownerItemId of new Set(runtime.jobs.map((job) => job.ownerItemId))) {
		const jobIds = runtime.jobs
			.filter((job) => job.ownerItemId === ownerItemId)
			.map((job) => job.id);
		if (jobIds.length > 1) {
			multipleActiveIssues.push({
				ownerItemId,
				jobIds,
				type: RuntimeCheckIssueEnumSchema.enum.JobOwnerMultipleActive,
			});
		}
	}

	for (const ownerItemId of new Set(entries.map((entry) => entry.ownerItemId))) {
		const owner = runtime.items.find((item) => item.id === ownerItemId);
		if (owner === undefined) continue;
		const maxQueueSize = readItemQueueSizeFn({
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
				type: RuntimeCheckIssueEnumSchema.enum.JobQueueExceeded,
			});
	}

	for (const item of runtime.items) {
		if (
			item.location.scope !== LocationScopeEnumSchema.enum.Job &&
			item.location.scope !== LocationScopeEnumSchema.enum.Reserved
		)
			continue;
		const location = item.location;
		if (!runtime.jobs.some((job) => job.id === location.jobId)) {
			materialOrphanIssues.push({
				itemId: item.id,
				jobId: location.jobId,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.JobMaterialOrphan,
			});
		}
	}

	const consumedItems = runtime.items.filter(
		(item): item is JobRuntimeItemSchema.Type =>
			item.location.scope === LocationScopeEnumSchema.enum.Job,
	);
	for (const item of consumedItems) {
		const owned = readRuntimeItemOwnedStateFn({
			ownerItemId: item.id,
			runtime,
		});
		if (
			owned.inputItems.length === 0 &&
			owned.jobs.length === 0 &&
			owned.jobItems.length === 0 &&
			owned.queue.length === 0
		) {
			continue;
		}
		consumedStateIssues.push({
			itemId: item.id,
			jobId: item.location.jobId,
			ownedItemIds: [
				...owned.inputItems.map((ownedItem) => ownedItem.id),
				...owned.jobItems.map((ownedItem) => ownedItem.id),
			],
			ownedJobIds: owned.jobs.map((job) => job.id),
			requestIds: owned.queue.map((request) => request.id),
			type: RuntimeCheckIssueEnumSchema.enum.JobConsumedMaterialState,
		});
	}

	return [
		...duplicateIssues,
		...ownerIssues,
		...multipleActiveIssues,
		...ownerGridIssues,
		...lineIssues,
		...queueIssues,
		...timeIssues,
		...materialOrphanIssues,
		...consumedStateIssues,
	];
};
