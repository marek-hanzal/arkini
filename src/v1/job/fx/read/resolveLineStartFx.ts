import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveJobQueueFx } from "~/v1/job/fx/read/resolveJobQueueFx";
import type { LineStartResolutionSchema } from "~/v1/job/schema/read/LineStartResolutionSchema";
import { resolveLineRunFx } from "~/v1/line/fx/run/resolveLineRunFx";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace resolveLineStartFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
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
		jobs: runtime.jobs,
		owner,
	});

	return {
		ownerItemId,
		lineId,
		run,
		queue,
		ready: run.ready && queue.available,
	} satisfies LineStartResolutionSchema.Type;
});
