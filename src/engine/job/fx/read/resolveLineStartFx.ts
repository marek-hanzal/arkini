import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readLineInputDeliveryClaimsFn } from "~/engine/delivery/fn/readLineInputDeliveryClaimsFn";
import { resolveJobQueueFx } from "~/engine/job/fx/read/resolveJobQueueFx";
import type { JobQueueResolutionSchema } from "~/engine/job/schema/read/JobQueueResolutionSchema";
import type { LineRun } from "~/engine/line/LineRun";
import { resolveLineRunFx } from "~/engine/line/fx/run/resolveLineRunFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveLineStartFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly run: LineRun.Resolution;
		readonly queue: JobQueueResolutionSchema.Type;
		readonly ready: boolean;
	}
}

/** Resolves all current state required to decide whether one explicit line start is possible. */
export const resolveLineStartFx = Effect.fn("resolveLineStartFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: resolveLineStartFx.Props) {
	const run = yield* resolveLineRunFx({
		ownerItemId,
		lineId,
		runtime,
	});
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const queue = yield* resolveJobQueueFx({
		runtime,
		owner,
	});
	const deliveryClaims = readLineInputDeliveryClaimsFn({
		ownerItemId,
		lineId,
		runtime,
	});

	return {
		ownerItemId,
		lineId,
		run,
		queue,
		ready: run.ready && queue.available && deliveryClaims.length === 0,
	} satisfies resolveLineStartFx.Result;
});
