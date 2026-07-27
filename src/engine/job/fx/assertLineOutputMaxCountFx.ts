import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobOutputMaxCountError } from "~/engine/job/error/JobOutputMaxCountError";
import { resolveLineStartOutputMaxCountFx } from "~/engine/job/fx/read/resolveLineStartOutputMaxCountFx";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace assertLineOutputMaxCountFx {
	export interface Props {
		readonly candidateId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: LineRunPlanSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Revalidates direct and bounded downstream output limits before queue admission. */
export const assertLineOutputMaxCountFx = Effect.fn("assertLineOutputMaxCountFx")(function* ({
	candidateId,
	lineId,
	ownerItemId,
	plan,
	runtime,
}: assertLineOutputMaxCountFx.Props) {
	const block = yield* resolveLineStartOutputMaxCountFx({
		ownerItemId,
		lineId,
		plan,
		runtime,
	});
	if (block === undefined) return;

	return yield* Effect.fail(
		new JobOutputMaxCountError({
			jobId: candidateId,
			ownerItemId,
			lineId,
			itemId: block.itemId,
			liveQuantity: block.liveQuantity,
			reservedQuantity: block.reservedQuantity,
			maxCount: block.maxCount,
			excessQuantity: block.excessQuantity,
		}),
	);
});
