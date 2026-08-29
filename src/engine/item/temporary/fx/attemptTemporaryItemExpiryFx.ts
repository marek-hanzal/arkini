import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { isExpectedPlacementDeliveryBlockFn } from "~/engine/placement/read/fn/isExpectedPlacementDeliveryBlockFn";
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

/** Resolves one ready temporary expiry and keeps only expected delivery failures local. */
export const attemptTemporaryItemExpiryFx = Effect.fn("attemptTemporaryItemExpiryFx")(function* ({
	itemId,
	runtime,
}: attemptTemporaryItemExpiryFx.Props) {
	return yield* completeTemporaryItemExpiryTransitionFx({
		itemId,
		runtime,
	}).pipe(
		Effect.map(
			(completion) =>
				({
					type: "expired",
					events: completion.events,
					runtime: completion.runtime,
				}) satisfies attemptTemporaryItemExpiryFx.Result,
		),
		Effect.catchTag("PlacementUnavailableError", (error) =>
			isExpectedPlacementDeliveryBlockFn(error.reason)
				? Effect.succeed({
						type: "blocked",
						error,
						runtime,
					} satisfies attemptTemporaryItemExpiryFx.Result)
				: Effect.fail(error),
		),
	);
});
