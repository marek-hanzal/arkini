import { Effect } from "effect";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { ItemRemovedReasonEnumSchema } from "~/engine/event/schema/ItemRemovedReasonEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readLifecycleItemEventsFx } from "~/engine/event/read/readLifecycleItemEventsFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { completeTemporaryItemExpiryTransitionFx } from "./completeTemporaryItemExpiryTransitionFx";

export namespace attemptTemporaryItemExpiryFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export type Result =
		| {
				type: "blocked";
				error: PlacementUnavailableError;
				runtime: RuntimeSchema.Type;
		  }
		| {
				type: "expired";
				events: readonly GameEventSchema.Type[];
				runtime: RuntimeSchema.Type;
		  };
}

const isExpectedExpiryBlock = (error: PlacementUnavailableError) => {
	switch (error.reason) {
		case "board:full":
		case "inventory:full":
		case "toolbar:full":
		case "item:max-count":
			return true;
	}
};

/** Resolves one ready temporary expiry and keeps only expected delivery failures local. */
export const attemptTemporaryItemExpiryFx = Effect.fn("attemptTemporaryItemExpiryFx")(function* ({
	itemId,
	runtime,
}: attemptTemporaryItemExpiryFx.Props) {
	return yield* completeTemporaryItemExpiryTransitionFx({
		itemId,
		runtime,
	}).pipe(
		Effect.flatMap((completion) =>
			readLifecycleItemEventsFx({
				outgoing: completion.expiredItem,
				placement: completion.placement,
				reason: ItemRemovedReasonEnumSchema.enum.Expired,
			}).pipe(
				Effect.map(
					(lifecycleEvents) =>
						({
							type: "expired",
							events: [
								{
									type: GameEventEnumSchema.enum.ItemExpired,
									itemId: completion.expiredItem.id,
									canonicalItemId: completion.expiredItem.item.id,
									location: completion.expiredItem.location,
									quantity: completion.expiredItem.quantity,
								},
								...lifecycleEvents,
							],
							runtime: completion.runtime,
						}) satisfies attemptTemporaryItemExpiryFx.Result,
				),
			),
		),
		Effect.catchTag("PlacementUnavailableError", (error) => {
			if (!isExpectedExpiryBlock(error)) return Effect.fail(error);
			return Effect.succeed({
				type: "blocked",
				error,
				runtime,
			} satisfies attemptTemporaryItemExpiryFx.Result);
		}),
	);
});
