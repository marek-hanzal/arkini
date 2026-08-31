import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import { resolveJobQueueFx } from "~/production-job/fx/read/resolveJobQueueFx";
import type { JobQueueResolutionSchema } from "~/production-job/schema/read/JobQueueResolutionSchema";
import type { LineRun } from "~/production-line/type/LineRun";
import { resolveLineRunFx } from "~/production-line/fx/run/resolveLineRunFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
