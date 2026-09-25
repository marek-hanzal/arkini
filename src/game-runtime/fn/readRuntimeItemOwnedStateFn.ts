import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { readRuntimeOwnershipClosureFn } from "~/game-runtime/fn/readRuntimeOwnershipClosureFn";

interface ReadRuntimeItemOwnedStateProps {
	ownerItemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

interface ReadRuntimeItemOwnedStateResult {
	ownerItemIds: ReadonlySet<IdSchema.Type>;
	inputItems: readonly RuntimeItemSchema.Type[];
	jobs: readonly JobSchema.Type[];
	jobItems: readonly RuntimeItemSchema.Type[];
	queue: readonly JobQueueRequestSchema.Type[];
}

/** Reads the complete runtime ownership tree beneath one live item identity. */
export const readRuntimeItemOwnedStateFn = ({
	ownerItemId,
	runtime,
}: ReadRuntimeItemOwnedStateProps) => {
	const { ownerItemIds, inputItemIds, jobIds, jobItemIds } = readRuntimeOwnershipClosureFn({
		rootItemIds: new Set([
			ownerItemId,
		]),
		items: runtime.items,
		jobs: runtime.jobs,
	});

	return {
		ownerItemIds,
		inputItems: runtime.items.filter((item) => inputItemIds.has(item.id)),
		jobs: runtime.jobs.filter((job) => jobIds.has(job.id)),
		jobItems: runtime.items.filter((item) => jobItemIds.has(item.id)),
		queue: runtime.jobQueue.filter((request) => ownerItemIds.has(request.ownerItemId)),
	} satisfies ReadRuntimeItemOwnedStateResult;
};
