import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { enqueueLineRuntimeFx } from "~/engine/job/fx/enqueueLineRuntimeFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

export namespace enqueueLineFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Appends one explicit queue intent without implicitly starting or filling the line. */
export const enqueueLineFx = Effect.fn("enqueueLineFx")(function* ({
	lineId,
	ownerItemId,
}: enqueueLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const queued = yield* enqueueLineRuntimeFx({
				lineId,
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
