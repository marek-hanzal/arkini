import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { OutputCapacityError } from "~/production-job/error/OutputCapacityError";
import { resolveStartOutputCapacityFx } from "~/production-job/fx/resolveStartOutputCapacityFx";
import type { LineRun } from "~/production-line/type/LineRun";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace assertOutputCapacityFx {
	export interface Props {
		readonly candidateId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: LineRun.Plan | undefined;
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
		new OutputCapacityError({
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
