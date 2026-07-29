import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileActorQueueBadgeCount {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Projects canonical active and queued line work only when it warrants a tile badge. */
export const readTileActorQueueBadgeCount = ({
	ownerItemId,
	runtime,
}: readTileActorQueueBadgeCount.Props) => {
	const count =
		runtime.jobs.filter((job) => job.ownerItemId === ownerItemId).length +
		(runtime.jobQueue ?? []).filter((request) => request.ownerItemId === ownerItemId).length;
	return count > 1 ? count : undefined;
};
