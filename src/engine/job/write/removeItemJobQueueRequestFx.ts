import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace removeItemJobQueueRequestFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly requestId: IdSchema.Type;
	}
}

/** Atomically removes one exact pending request owned by one live item. */
export const removeItemJobQueueRequestFx = Effect.fn("removeItemJobQueueRequestFx")(function* ({
	ownerItemId,
	requestId,
}: removeItemJobQueueRequestFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});

			const removedRequest = (runtime.jobQueue ?? []).find(
				(request) => request.id === requestId && request.ownerItemId === ownerItemId,
			);
			if (removedRequest === undefined) {
				return [
					removedRequest,
					runtime,
				] as const;
			}

			return [
				removedRequest,
				{
					...runtime,
					jobQueue: (runtime.jobQueue ?? []).filter(
						(request) =>
							request.id !== requestId || request.ownerItemId !== ownerItemId,
					),
				} satisfies RuntimeSchema.Type,
			] as const;
		}),
	);
});
