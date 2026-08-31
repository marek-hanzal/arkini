import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { removeRuntimeItemFx } from "~/game-runtime/fx/removeRuntimeItemFx";
import { readValidatedRuntimeItemFx } from "~/item-interaction/fx/readValidatedRuntimeItemFx";

export namespace removeItemRuntimeTransitionFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
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
	const item = yield* readValidatedRuntimeItemFx({
		itemId,
		revision,
		runtime,
	});
	yield* assertOwnerIdleFx({
		ownerItemId: item.id,
		runtime,
	});

	const explicitlyRemovedEvent = {
		type: GameEventEnumSchema.enum.ItemExplicitlyRemoved,
		itemId: item.id,
		canonicalItemId: item.item.id,
		location: item.location,
		quantity: item.quantity,
	} satisfies GameEventSchema.Type;
	const removal = yield* removeRuntimeItemFx({
		item,
		runtime,
	});

	return {
		events: [
			explicitlyRemovedEvent,
			...removal.events,
		],
		item,
		runtime: removal.runtime,
	} satisfies removeItemRuntimeTransitionFx.Result;
});
