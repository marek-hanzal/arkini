import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { readDefaultLineQueueTargetFx } from "~/production-job/fx/readDefaultLineQueueTargetFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

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
