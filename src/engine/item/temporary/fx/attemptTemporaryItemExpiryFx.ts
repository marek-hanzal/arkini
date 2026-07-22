import { Effect } from "effect";

import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
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
		case PlacementFailureReasonEnumSchema.enum.BoardFull:
		case PlacementFailureReasonEnumSchema.enum.InventoryFull:
		case PlacementFailureReasonEnumSchema.enum.ToolbarFull:
		case PlacementFailureReasonEnumSchema.enum.ItemMaxCount:
			return true;
	}
};

/** Resolves one ready temporary expiry and keeps only expected delivery failures local. */
export const attemptTemporaryItemExpiryFx = Effect.fn("attemptTemporaryItemExpiryFx")(function* ({
	itemId,
	runtime,
}: attemptTemporaryItemExpiryFx.Props) {
	return yield* completeTemporaryItemExpiryTransitionFx({ itemId, runtime }).pipe(
		Effect.map(
			(completion) =>
				({
					type: "expired",
					events: completion.events,
					runtime: completion.runtime,
				}) satisfies attemptTemporaryItemExpiryFx.Result,
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
