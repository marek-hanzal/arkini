import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileActorQueueBadgeCountFn {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Projects every canonical active or queued line-work count as a tile status badge. */
export const readTileActorQueueBadgeCountFn = ({
	ownerItemId,
	runtime,
}: readTileActorQueueBadgeCountFn.Props) => {
	const count =
		runtime.jobs.filter((job) => job.ownerItemId === ownerItemId).length +
		runtime.jobQueue.filter((request) => request.ownerItemId === ownerItemId).length;
	return count > 0 ? count : undefined;
};
