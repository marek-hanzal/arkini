import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { JobOutputMaxCountError } from "~/engine/job/error/JobOutputMaxCountError";
import { readReservedJobOutputQuantitiesFx } from "~/engine/job/fx/read/readReservedJobOutputQuantitiesFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const reserved = yield* readReservedJobOutputQuantitiesFx({
		runtime,
	});

	for (const [itemId, reservation] of reserved) {
		const reservedQuantity = reservation.quantity;
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
