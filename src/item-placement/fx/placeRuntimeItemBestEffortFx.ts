import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readRuntimeItemOwnedStateFn } from "~/game-runtime/fn/readRuntimeItemOwnedStateFn";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import { discardRuntimeItemTreeFx } from "~/game-runtime/fx/discardRuntimeItemTreeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
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
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	while (true) {
		const item = yield* readRuntimeItemByIdFx({
			itemId,
			runtime: draft,
		});
		const attempt = yield* placeRuntimeItemFx({
			itemId,
			origin,
			originItemId,
			runtime: draft,
		}).pipe(
			Effect.map((placement) => ({
				type: "placed" as const,
				placement,
			})),
			Effect.catchTag("PlacementUnavailableError", (error) =>
				Effect.succeed({
					type: "blocked" as const,
					error,
				}),
			),
		);
		if (attempt.type === "placed")
			return {
				runtime: attempt.placement.runtime,
				events: [
					...events,
					...attempt.placement.events,
				],
			} satisfies placeRuntimeItemBestEffortFx.Result;
		const reason = attempt.error.reason;
		const lostQuantity = Math.min(item.quantity, attempt.error.remainingQuantity);
		if (lostQuantity === item.quantity) {
			const discarded = yield* discardRuntimeItemTreeFx({
				item,
				ownerItemId: originItemId,
				source,
				reason,
				runtime: draft,
			});
			return {
				runtime: discarded.runtime,
				events: [
					...events,
					...discarded.events,
				],
			} satisfies placeRuntimeItemBestEffortFx.Result;
		}
		const reduced = yield* reviseRuntimeItemFx({
			item: {
				...item,
				quantity: item.quantity - lostQuantity,
			},
		});
		draft = {
			...draft,
			items: draft.items.map((candidate) => (candidate.id === item.id ? reduced : candidate)),
		};
		events.push({
			type: "item:discarded",
			ownerItemId: originItemId,
			canonicalItemId: item.item.id,
			itemId: item.id,
			quantity: lostQuantity,
			source,
			reason,
		});
	}
});
