import { Effect } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace clearItemJobQueueFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
	}
}

/** Atomically removes every pending line-start request owned by one live item. */
export const clearItemJobQueueFx = Effect.fn("clearItemJobQueueFx")(function* ({
	ownerItemId,
}: clearItemJobQueueFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});

			const clearedRequests = runtime.jobQueue.filter(
				(request) => request.ownerItemId === ownerItemId,
			);
			if (clearedRequests.length === 0) {
				return [
					clearedRequests,
					runtime,
				] as const;
			}

			const nextRuntime = {
				...runtime,
				jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== ownerItemId),
			} satisfies RuntimeSchema.Type;

			return [
				clearedRequests,
				nextRuntime,
			] as const;
		}),
	);
});
