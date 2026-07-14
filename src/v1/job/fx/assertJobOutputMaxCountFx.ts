import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import { JobOutputMaxCountError } from "~/v1/job/error/JobOutputMaxCountError";
import { readJobMaximumOutputQuantitiesFx } from "~/v1/job/fx/read/readJobMaximumOutputQuantitiesFx";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace assertJobOutputMaxCountFx {
	export interface Props {
		job: JobSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Rejects a newly active job when all active future outputs overbook maxCount. */
export const assertJobOutputMaxCountFx = Effect.fn("assertJobOutputMaxCountFx")(function* ({
	job,
	runtime,
}: assertJobOutputMaxCountFx.Props) {
	const reserved = new Map<IdSchema.Type, number>();
	for (const activeJob of runtime.jobs) {
		const quantities = yield* readJobMaximumOutputQuantitiesFx({
			job: activeJob,
			runtime,
		});
		for (const [itemId, quantity] of quantities) {
			reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
		}
	}

	for (const [itemId, reservedQuantity] of reserved) {
		const item = yield* resolveItemFx({
			itemId,
		});
		if (item.maxCount === undefined) continue;

		const liveQuantity = runtime.items.reduce(
			(quantity, candidate) =>
				candidate.item.id === itemId ? quantity + candidate.quantity : quantity,
			0,
		);
		const excessQuantity = liveQuantity + reservedQuantity - item.maxCount;
		if (excessQuantity <= 0) continue;

		return yield* Effect.fail(
			new JobOutputMaxCountError({
				jobId: job.id,
				ownerItemId: job.ownerItemId,
				lineId: job.lineId,
				itemId,
				liveQuantity,
				reservedQuantity: reservedQuantity as PositiveIntegerSchema.Type,
				maxCount: item.maxCount,
				excessQuantity: excessQuantity as PositiveIntegerSchema.Type,
			}),
		);
	}
});
