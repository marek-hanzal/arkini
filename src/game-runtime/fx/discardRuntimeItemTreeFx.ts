import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readRuntimeItemOwnedStateFn } from "~/game-runtime/fn/readRuntimeItemOwnedStateFn";
import { discardRuntimeItemOwnedStateFx } from "~/game-runtime/fx/discardRuntimeItemOwnedStateFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";

type DiscardEvent = Extract<
	GameEventSchema.Type,
	{
		type: "item:discarded";
	}
>;

export namespace discardRuntimeItemTreeFx {
	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly source: DiscardEvent["source"];
		readonly reason: DiscardEvent["reason"];
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly events: readonly GameEventSchema.Type[];
	}
}

/** Discards one idle root and its passive inputs, auditing every lost identity in the same draft. */
export const discardRuntimeItemTreeFx = Effect.fn("discardRuntimeItemTreeFx")(function* ({
	item,
	ownerItemId,
	source,
	reason,
	runtime,
}: discardRuntimeItemTreeFx.Props) {
	const owned = readRuntimeItemOwnedStateFn({
		ownerItemId: item.id,
		runtime,
	});
	const detached = yield* discardRuntimeItemOwnedStateFx({
		ownerItemId: item.id,
		runtime,
	});
	const removed = yield* removeRuntimeItemIdentityFx({
		item,
		runtime: detached.runtime,
	});
	return {
		runtime: removed.runtime,
		events: [
			...detached.events,
			...removed.events,
			...[
				item,
				...owned.inputItems,
			].map(
				(lost): DiscardEvent => ({
					type: "item:discarded",
					ownerItemId,
					itemId: lost.id,
					itemUid: lost.item.uid,
					quantity: 1,
					source,
					reason,
				}),
			),
		],
	} satisfies discardRuntimeItemTreeFx.Result;
});
