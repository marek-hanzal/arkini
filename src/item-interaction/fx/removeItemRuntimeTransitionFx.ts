import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { EngineFact } from "~/game-event/type/EngineFact";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { removeRuntimeItemFx } from "~/game-runtime/fx/removeRuntimeItemFx";
import { readRuntimeCommandTargetFx } from "~/game-runtime/fx/readRuntimeCommandTargetFx";
import { cancelItemTerminationWorkFx } from "~/item-terminal/fx/cancelItemTerminationWorkFx";

export namespace removeItemRuntimeTransitionFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly EngineFact[];
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Computes the canonical validated item-removal transition inside one caller-owned mutation. */
export const removeItemRuntimeTransitionFx = Effect.fn("removeItemRuntimeTransitionFx")(function* ({
	itemId,
	revision,
	runtime,
}: removeItemRuntimeTransitionFx.Props) {
	const item = yield* readRuntimeCommandTargetFx({
		itemId,
		revision,
		runtime,
	});
	const cancelled = yield* cancelItemTerminationWorkFx({
		itemId: item.id,
		runtime,
	});
	yield* assertOwnerIdleFx({
		ownerItemId: item.id,
		runtime: cancelled.runtime,
	});

	const disappearedEvent = {
		type: GameEventEnumSchema.enum.ItemDisappeared,
		itemId: item.id,
		itemUid: item.item.uid,
		location: item.location,
	} satisfies GameEventSchema.Type;
	const removal = yield* removeRuntimeItemFx({
		item,
		runtime: cancelled.runtime,
	});

	return {
		events: [
			...cancelled.facts,
			disappearedEvent,
			...removal.events,
		],
		item,
		runtime: removal.runtime,
	} satisfies removeItemRuntimeTransitionFx.Result;
});
