import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readItemDetailQueue {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Request {
		readonly requestId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly title: string;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly capacity: number;
				readonly activeCount: number;
				readonly request: readonly Request[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailQueue.Result;

/** Projects queued line-start intents for one exact producer with queue semantics. */
export const readItemDetailQueue = ({
	itemId,
	runtime,
}: readItemDetailQueue.Props): readItemDetailQueue.Result => {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner?.item.type !== ItemEnumSchema.enum.Producer || owner.item.maxQueueSize <= 1)
		return unavailable;
	const lineById = new Map(
		readLineOwnerLines(owner.item).map((line) => [
			line.id,
			line,
		]),
	);
	return {
		kind: "available",
		itemId: owner.id,
		capacity: owner.item.maxQueueSize,
		activeCount: runtime.jobs.filter((job) => job.ownerItemId === owner.id).length,
		request: (runtime.jobQueue ?? [])
			.filter((request) => request.ownerItemId === owner.id)
			.map((request) => ({
				requestId: request.id,
				lineId: request.lineId,
				title: lineById.get(request.lineId)?.title ?? request.lineId,
			})),
	};
};
