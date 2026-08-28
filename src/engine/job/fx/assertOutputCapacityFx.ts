import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobOutputMaxCountError } from "~/engine/job/error/JobOutputMaxCountError";
import { resolveStartOutputCapacityFx } from "~/engine/job/fx/read/resolveStartOutputCapacityFx";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace assertOutputCapacityFx {
	export interface Props {
		readonly candidateId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: LineRunPlanSchema.Type | undefined;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Revalidates direct and bounded downstream output limits before start or queue admission. */
export const assertOutputCapacityFx = Effect.fn("assertOutputCapacityFx")(function* ({
	candidateId,
	lineId,
	ownerItemId,
	plan,
	runtime,
}: assertOutputCapacityFx.Props) {
	const block = yield* resolveStartOutputCapacityFx({
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
