import { Effect, Option } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { readItemQueueSizeFx } from "~/engine/job/read/readItemQueueSizeFx";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

interface ItemDetailQueueRequest {
	readonly requestId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly title: string;
}

interface ItemDetailQueueActiveJob {
	readonly jobId: IdSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly title: string;
	readonly status: JobStatusEnumSchema.Type;
	readonly durationMs: number;
	readonly remainingMs: number;
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
				readonly active: readonly ItemDetailQueueActiveJob[];
				readonly request: readonly ItemDetailQueueRequest[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailQueueFx.Result;

/** Projects active and queued line work for one exact line owner. */
export const readItemDetailQueueFx = Effect.fn("readItemDetailQueueFx")(function* ({
	itemId,
	runtime,
}: readItemDetailQueueFx.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner === undefined) return unavailable;
	const lineOwner = yield* isLineOwnerItemFx(owner.item);
	if (Option.isNone(lineOwner)) return unavailable;
	const capacity = yield* readItemQueueSizeFx({
		item: lineOwner.value,
	});
	if (capacity === undefined) return unavailable;
	const lineById = new Map(
		(yield* readLineOwnerLinesFx(lineOwner.value)).map((line) => [
			line.id,
			line,
		]),
	);
	const active = yield* Effect.forEach(
		runtime.jobs.filter((job) => job.ownerItemId === owner.id),
		(job) =>
			resolveActiveJobStatusFx({
				job,
				runtime,
			}).pipe(
				Effect.map((status) => ({
					jobId: job.id,
					lineId: job.lineId,
					title: lineById.get(job.lineId)?.title ?? job.lineId,
					status,
					durationMs: job.durationMs,
					remainingMs: job.remainingMs,
				})),
			),
	);
	return {
		kind: "available",
		itemId: owner.id,
		capacity,
		active,
		request: (runtime.jobQueue ?? [])
			.filter((request) => request.ownerItemId === owner.id)
			.map((request) => ({
				requestId: request.id,
				lineId: request.lineId,
				title: lineById.get(request.lineId)?.title ?? request.lineId,
			})),
	};
});
