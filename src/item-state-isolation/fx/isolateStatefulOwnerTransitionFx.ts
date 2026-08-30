import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { isolateGridStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateGridStatefulOwnerTransitionFx";
import { isBoardRuntimeItemFn } from "~/game-runtime/read/fn/isBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace isolateStatefulOwnerTransitionFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Preserves the Line-owned Board admission before shared grid isolation. */
export const isolateStatefulOwnerTransitionFx = Effect.fn("isolateStatefulOwnerTransitionFx")(
	function* ({ ownerItemId, runtime }: isolateStatefulOwnerTransitionFx.Props) {
		const runtimeOwner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		if (Option.isNone(isBoardRuntimeItemFn(runtimeOwner))) {
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
	},
);
