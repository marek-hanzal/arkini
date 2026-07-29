import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Removes every pending request for one exact owner line while preserving global FIFO order. */
export const removeLineJobQueueRequests = ({
	lineId,
	ownerItemId,
	runtime,
}: {
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}): RuntimeSchema.Type => {
	const jobQueue = (runtime.jobQueue ?? []).filter(
		(request) => request.ownerItemId !== ownerItemId || request.lineId !== lineId,
	);
	return jobQueue.length === (runtime.jobQueue ?? []).length
		? runtime
		: {
				...runtime,
				jobQueue,
			};
};
