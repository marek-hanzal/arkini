import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readRuntimeItemOwnedStateFn } from "~/game-runtime/fn/readRuntimeItemOwnedStateFn";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import { discardRuntimeItemTreeFx } from "~/game-runtime/fx/discardRuntimeItemTreeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { placeRuntimeItemFx } from "~/item-placement/fx/placeRuntimeItemFx";

export namespace placeRuntimeItemBestEffortFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly origin: BoardLocationSchema.Type;
		readonly originItemId: IdSchema.Type;
		readonly source: "reservation" | "buffer";
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly events: readonly GameEventSchema.Type[];
	}
}

/** Returns as much existing material as fits; only capacity rejection allows audited loss.
 * Stateful identities remain whole and retain their passive ownership tree when placed. */
export const placeRuntimeItemBestEffortFx = Effect.fn("placeRuntimeItemBestEffortFx")(function* ({
	itemId,
	origin,
	originItemId,
	source,
	runtime,
}: placeRuntimeItemBestEffortFx.Props) {
	const owned = readRuntimeItemOwnedStateFn({
		ownerItemId: itemId,
		runtime,
	});
	if (owned.jobs.length > 0 || owned.jobItems.length > 0 || owned.queue.length > 0) {
		return yield* Effect.fail(
			new JobOwnerBusyError({
				ownerItemId: itemId,
				jobIds: owned.jobs.map((job) => job.id),
				requestIds: owned.queue.map((request) => request.id),
			}),
		);
	}
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	return yield* placeRuntimeItemFx({
		itemId,
		origin,
		originItemId,
		runtime,
	}).pipe(
		Effect.catchTag("PlacementUnavailableError", (error) =>
			discardRuntimeItemTreeFx({
				item,
				ownerItemId: originItemId,
				source,
				reason: error.reason,
				runtime,
			}),
		),
	);
});
