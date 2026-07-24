import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

interface ItemDetailQueueRequest {
	readonly requestId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly title: string;
}

export namespace readItemDetailQueueFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly capacity: number;
				readonly activeCount: number;
				readonly request: readonly ItemDetailQueueRequest[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailQueueFx.Result;

/** Projects queued line-start intents for one exact producer with queue semantics. */
export const readItemDetailQueueFx = Effect.fn("readItemDetailQueueFx")(function* ({
	itemId,
	runtime,
}: readItemDetailQueueFx.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner?.item.type !== ItemEnumSchema.enum.Producer || owner.item.maxQueueSize <= 1)
		return unavailable;
	const lineById = new Map(
		(yield* readLineOwnerLinesFx(owner.item)).map((line) => [
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
});
