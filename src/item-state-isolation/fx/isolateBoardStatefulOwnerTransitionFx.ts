import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { isolateGridStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateGridStatefulOwnerTransitionFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace isolateBoardStatefulOwnerTransitionFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Preserves Board admission before shared grid isolation. */
export const isolateBoardStatefulOwnerTransitionFx = Effect.fn(
	"isolateBoardStatefulOwnerTransitionFx",
)(function* ({ ownerItemId, runtime }: isolateBoardStatefulOwnerTransitionFx.Props) {
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (Option.isNone(narrowBoardRuntimeItemFn(runtimeOwner))) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	}
	return yield* isolateGridStatefulOwnerTransitionFx({
		ownerItemId,
		runtime,
	});
});
