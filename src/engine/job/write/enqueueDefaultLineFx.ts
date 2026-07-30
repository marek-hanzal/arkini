import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { enqueueLineRuntimeFx } from "~/engine/job/fx/enqueueLineRuntimeFx";
import { readDefaultLineQueueTargetFx } from "~/engine/job/fx/read/readDefaultLineQueueTargetFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

export namespace enqueueDefaultLineFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Appends one intent for the exact live owner's current effective default line. */
export const enqueueDefaultLineFx = Effect.fn("enqueueDefaultLineFx")(function* ({
	ownerItemId,
}: enqueueDefaultLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const line = yield* readDefaultLineQueueTargetFx({
				ownerItemId,
				runtime,
			});
			const queued = yield* enqueueLineRuntimeFx({
				lineId: line.id,
				ownerItemId,
				runtime,
			});
			return [
				queued.request,
				queued.runtime,
				queued.events,
			] as const;
		}),
	);
});
