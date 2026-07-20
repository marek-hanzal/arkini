import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { completeTemporaryItemExpiryFx } from "./completeTemporaryItemExpiryFx";

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

/** Keeps only expected temporary-output placement failures local to Tick. */
export const attemptTemporaryItemExpiryFx = Effect.fn("attemptTemporaryItemExpiryFx")(function* ({
	itemId,
	runtime,
}: attemptTemporaryItemExpiryFx.Props) {
	return yield* completeTemporaryItemExpiryFx({
		itemId,
		runtime,
	}).pipe(
		Effect.map(
			(nextRuntime) =>
				({
					type: "expired",
					runtime: nextRuntime,
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
