import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace enqueueLineFx {
	export interface Props {
		readonly lineUid: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
	}
}

/** Appends one explicit queue intent without implicitly starting or filling the line. */
export const enqueueLineFx = Effect.fn("enqueueLineFx")(function* ({
	lineUid,
	ownerItemId,
}: enqueueLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* assertItemProductionPlayerControlFx({
				ownerItemId,
				runtime,
			});
			const queued = yield* enqueueLineRuntimeFx({
				lineUid,
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
